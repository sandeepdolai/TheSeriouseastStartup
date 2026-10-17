/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — server-authorized Cloudinary uploads.

   The browser never uploads to Cloudinary on its own authority. Before any
   publish-time upload, the client asks POST /api/uploads/authorize. The
   server resolves the signed-in user, enforces per-user rolling quotas,
   chooses a user/site-specific destination and hands back Cloudinary upload
   parameters (folder + public_id + upload preset + timestamp) signed with
   the server-only CLOUDINARY_API_SECRET.

   Cloudinary's signature rule makes the signed parameters tamper-proof:
   the signature is validated over every signable parameter present in the
   upload request, so the client cannot add, remove or alter signed params
   (destination folder, public id, preset, timestamp) — only attach the
   file. The API secret itself never leaves the server.

   This module is server-safe: it reads server env vars and uses node:crypto.
   The pure helpers (signature, folder builders, quota window math, reference
   policy) are unit-tested in tests/upload-authorization.test.mts.
─────────────────────────────────────────────────────────────────────────── */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

/* ── Configuration ──────────────────────────────────────────────────────── */

export const SIGNED_UPLOAD_PURPOSES = [
  "template-photos",
  "smart-edit",
  "template-assets",
  "sticker-library",
] as const;
export type SignedUploadPurpose = (typeof SIGNED_UPLOAD_PURPOSES)[number];

/** Purpose reserved for the administrator (community-template namespace). */
export const ADMIN_ONLY_PURPOSE: SignedUploadPurpose = "template-assets";

export interface SignedUploadServerConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Signed-mode upload preset (Cloudinary enforces its allowed_formats). */
  uploadPreset: string;
}

export const DEFAULT_SIGNED_UPLOAD_PRESET = "paper_stish_signed_uploads";

export function signedUploadServerConfig(): SignedUploadServerConfig | null {
  const cloudName = (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME ||
    ""
  ).trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
  const uploadPreset = (
    process.env.CLOUDINARY_SIGNED_UPLOAD_PRESET || DEFAULT_SIGNED_UPLOAD_PRESET
  ).trim();
  if (!cloudName || !apiKey || !apiSecret || !uploadPreset) return null;
  return { cloudName, apiKey, apiSecret, uploadPreset };
}

/* ── Destinations (user/site-specific) ──────────────────────────────────── */

export const PUBLISHED_MEDIA_ROOT = "paper-stish/published-websites";

/** User-scoped namespace: every signed upload lands under the uploader's id. */
export function userMediaRoot(userId: string): string {
  return `${PUBLISHED_MEDIA_ROOT}/u/${userId}`;
}

/** Cloudinary public ids/folders are limited to these characters. */
function sanitizeSegment(value: string, max: number): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, max);
}

/** Destination folder for a purpose. Server-chosen — never client input. */
export function uploadFolderForPurpose(
  userId: string,
  purpose: SignedUploadPurpose,
  projectId?: string,
): string {
  if (purpose === "sticker-library") {
    // Shared, platform-owned media. Only the admin receives upload grants.
    return "paper-stish/library/stickers";
  }
  if (purpose === ADMIN_ONLY_PURPOSE) {
    // Administrator community-template namespace (cleanup-script compatible).
    const segment = sanitizeSegment(projectId ?? "", 64) || randomBytes(6).toString("hex");
    return `paper-stish/templates/${segment}`;
  }
  if (purpose === "smart-edit") {
    const site = sanitizeSegment(projectId ?? "", 64) || randomBytes(6).toString("hex");
    return `${userMediaRoot(userId)}/sites/${site}`;
  }
  return `${userMediaRoot(userId)}/template-photos`;
}

/** New unique suffix for one upload (Cloudinary composes the final public
 *  id as `<folder>/<suffix>` in dynamic folder mode). */
export function newUploadSuffix(): string {
  return randomBytes(10).toString("base64url");
}

/** Final Cloudinary public id an upload under `folder` will receive. */
export function composedPublicId(folder: string, suffix: string): string {
  return `${folder}/${suffix}`;
}

/* ── Cloudinary signature ───────────────────────────────────────────────── */

/**
 * Cloudinary signature: SHA-1 over the signable parameters sorted by key,
 * joined as `k=v` pairs with `&`, with the API secret appended. Only the
 * parameters named in `params` are covered — everything the client must not
 * change (folder, public_id, upload_preset, timestamp).
 */
export function cloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

/** Constant-time signature comparison (defense in depth for replay checks). */
export function signaturesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/* ── Quotas (abuse prevention) ──────────────────────────────────────────── */

export const UPLOAD_AUTHORIZATION_TTL_MS = 60 * 60 * 1000; // 60 minutes
/** Rolling-window limits per user. Generous for real publishes (photo album
 *  = 7 images), tight enough to bound a hostile or scripted client. */
export const UPLOADS_PER_HOUR = 120;
export const UPLOADS_PER_DAY = 480;

export interface QuotaWindowState {
  lastHour: number;
  lastDay: number;
}

export interface QuotaDecision {
  allowed: boolean;
  /** Seconds until enough quota frees up (for Retry-After). */
  retryAfterSeconds?: number;
}

/** Pure quota check — unit-tested with injected clocks/counts. */
export function quotaDecision(
  state: QuotaWindowState,
  requested: number,
  limits = { hour: UPLOADS_PER_HOUR, day: UPLOADS_PER_DAY },
): QuotaDecision {
  const totalHour = state.lastHour + requested;
  const totalDay = state.lastDay + requested;
  if (totalDay > limits.day) {
    return { allowed: false, retryAfterSeconds: 6 * 60 * 60 };
  }
  if (totalHour > limits.hour) {
    return { allowed: false, retryAfterSeconds: 60 * 60 };
  }
  return { allowed: true };
}

/* ── Authorization records ──────────────────────────────────────────────── */

export interface UploadAuthorizationGrant {
  /** What the client sends to Cloudinary verbatim. */
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  folder: string;
  /** The short public_id PARAMETER to send (Cloudinary composes the final
   *  id as `<folder>/<uploadPublicId>` in dynamic folder mode). */
  uploadPublicId: string;
  /** Final public id the uploaded asset will carry (recorded server-side
   *  and enforced by the publish-time reference policy). */
  publicId: string;
  timestamp: number;
  signature: string;
  /** Client-side expiry of this grant (epoch ms). */
  expiresAt: number;
}

export function buildGrant(
  config: SignedUploadServerConfig,
  userId: string,
  purpose: SignedUploadPurpose,
  projectId?: string,
  now: number = Date.now(),
): UploadAuthorizationGrant {
  const folder = uploadFolderForPurpose(userId, purpose, projectId);
  const uploadPublicId = newUploadSuffix();
  const publicId = composedPublicId(folder, uploadPublicId);
  const timestamp = Math.floor(now / 1000);
  const signature = cloudinarySignature(
    { folder, public_id: uploadPublicId, timestamp, upload_preset: config.uploadPreset },
    config.apiSecret,
  );
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    uploadPreset: config.uploadPreset,
    folder,
    uploadPublicId,
    publicId,
    timestamp,
    signature,
    expiresAt: now + UPLOAD_AUTHORIZATION_TTL_MS,
  };
}
