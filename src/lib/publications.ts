/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — publications (the server sync point).

   Publishing is the ONLY moment a local project reaches the Paper Stish
   server: the editor sends the current snapshot to POST /api/publish, the
   server validates it, stores it as a Publication row and returns the
   small link parts —

     /{username}/{viewerName}/{templateId}

   The public viewer resolves that templateId server-side; the payload is
   never placed in the URL. Republishing sends `previousTemplateId` so the
   server can keep the existing public link working.

   This module is client + server safe (no "use client", no browser APIs
   at module scope) so the same validation runs in the publish API, the
   viewer page and the browser.
─────────────────────────────────────────────────────────────────────────── */

import type { SmartEditDocument } from "@/components/smartedit/types";
import { validateSmartEditDocument } from "@/components/smartedit/publish";
import { slugPart } from "@/lib/slug";

export { slugPart };

/** Template types that can be published. */
export const PUBLISHABLE_TEMPLATE_SLUGS = [
  "smart-edit",
  "birthday-template",
  "love-of-my-life",
  "photo-album",
] as const;

export type PublishableTemplateSlug = (typeof PUBLISHABLE_TEMPLATE_SLUGS)[number];

/** Maximum serialized size of a normal template's values (photos included). */
export const TEMPLATE_VALUES_MAX_BYTES = 4_000_000;

/* ── Types ──────────────────────────────────────────────────────────────── */

/** Editable values of a normal template (Birthday, Love of My Life). */
export interface TemplatePublicationValues {
  heading?: string;
  /** Extra editable copy used by the fixed personal website themes. */
  intro?: string;
  noteHeading?: string;
  signature?: string;
  years?: string;
  yearsLabel?: string;
  sideNote?: string;
  message?: string;
  photoUrl?: string | null;
  /** Photo Album supports up to six optimized, user-uploaded images. */
  images?: string[];
  /** Optional captions, aligned with the album image array. */
  captions?: string[];
}

/** What the public viewer receives for a published website. */
export interface PublishedWebsitePayload {
  version: 1;
  templateSlug: PublishableTemplateSlug;
  title: string;
  publishedAt: string;
  /** Smart Edit publications carry the full document. */
  document?: SmartEditDocument;
  /** Normal template publications carry their editable values. */
  values?: TemplatePublicationValues;
}

/** Result of POST /api/publish. */
export interface PublishResult {
  templateId: string;
  username: string;
  viewerName: string;
  title: string;
  publishedAt: string;
}

/** Publication info stored inside a local project record. */
export interface PublishedRecord {
  username: string;
  viewerName: string;
  templateId: string;
  url: string;
  publishedAt: string;
}

export interface PublishWebsiteBody {
  templateSlug: string;
  title: string;
  username: string;
  viewerName: string;
  /** Keeps the previous public link working when republishing. */
  previousTemplateId?: string;
  data: { document?: unknown; values?: unknown };
}

/* ── Validation ─────────────────────────────────────────────────────────── */

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}

const PHOTO_URL_RE =
  /^(data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s"'<>]+)$/;

/** Validate untrusted normal-template values (same rules everywhere). */
export function validateTemplateValues(raw: unknown): TemplatePublicationValues | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const photoUrl =
    v.photoUrl === null || v.photoUrl === undefined || v.photoUrl === ""
      ? null
      : boundedString(v.photoUrl, 8_000_000);
  if (photoUrl !== null && (!photoUrl || !PHOTO_URL_RE.test(photoUrl))) return null;
  let images: string[] | undefined;
  if (v.images !== undefined) {
    if (!Array.isArray(v.images) || v.images.length > 6) return null;
    images = [];
    for (const item of v.images) {
      if (typeof item !== "string" || item.length > 560_000 || !PHOTO_URL_RE.test(item)) return null;
      images.push(item);
    }
  }

  let captions: string[] | undefined;
  if (v.captions !== undefined) {
    if (!Array.isArray(v.captions) || v.captions.length > 6) return null;
    captions = [];
    for (const item of v.captions) {
      if (typeof item !== "string" || item.length > 120) return null;
      captions.push(item);
    }
  }

  const values: TemplatePublicationValues = {
    heading: boundedString(v.heading, 200),
    intro: boundedString(v.intro, 400),
    noteHeading: boundedString(v.noteHeading, 240),
    signature: boundedString(v.signature, 160),
    years: boundedString(v.years, 40),
    yearsLabel: boundedString(v.yearsLabel, 80),
    sideNote: boundedString(v.sideNote, 80),
    message: boundedString(v.message, 4000),
    photoUrl,
    images,
    captions,
  };
  return values;
}

/** Validate an untrusted published-website payload (viewer + server). */
export function validatePublishedPayload(raw: unknown): PublishedWebsitePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1) return null;
  const templateSlug = boundedString(p.templateSlug, 60);
  if (!templateSlug || !(PUBLISHABLE_TEMPLATE_SLUGS as readonly string[]).includes(templateSlug)) {
    return null;
  }

  const base = {
    version: 1 as const,
    templateSlug: templateSlug as PublishableTemplateSlug,
    title: boundedString(p.title, 120) ?? "Paper Stish",
    publishedAt: boundedString(p.publishedAt, 40) ?? new Date().toISOString(),
  };

  if (templateSlug === "smart-edit") {
    const document = validateSmartEditDocument(p.document);
    if (!document) return null;
    return { ...base, document };
  }

  const values = validateTemplateValues(p.values);
  if (!values) return null;
  return { ...base, values };
}

/** Row shape handed to publicationRowToPayload by the server. */
export interface PublicationRow {
  templateSlug: string;
  title: string;
  data: string;
  publishedAt: Date | string;
}

/** Turn a stored Publication row into the public viewer payload,
 *  re-validating the snapshot so a corrupted row can never reach a viewer. */
export function publicationRowToPayload(row: PublicationRow): PublishedWebsitePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const container = parsed as Record<string, unknown>;
  return validatePublishedPayload({
    version: 1,
    templateSlug: row.templateSlug,
    title: row.title,
    publishedAt:
      row.publishedAt instanceof Date
        ? row.publishedAt.toISOString()
        : String(row.publishedAt),
    document: container.document,
    values: container.values,
  });
}

/* ── Client helpers ─────────────────────────────────────────────────────── */

/**
 * Public website URL — /{username}/{viewerName}/{templateId}.
 * The published website is resolved server-side from the templateId;
 * nothing is ever appended to the URL.
 */
export function buildPublicUrl(username: string, viewerName: string, templateId: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = `${basePath}/${username}/${viewerName}/${templateId}`;
  return window.location.origin + path;
}

/** Build the PublishedRecord stored in the local project from a publish result. */
export function publishResultToRecord(result: PublishResult): PublishedRecord {
  return {
    username: result.username,
    viewerName: result.viewerName,
    templateId: result.templateId,
    url: buildPublicUrl(result.username, result.viewerName, result.templateId),
    publishedAt: result.publishedAt,
  };
}

/** POST /api/publish — store a publication snapshot server-side. */
export async function publishWebsite(body: PublishWebsiteBody): Promise<PublishResult> {
  let res: Response;
  try {
    res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the Paper Stish server. Check your connection and try again.");
  }
  if (res.ok) {
    return (await res.json()) as PublishResult;
  }
  let message = "";
  try {
    const errorBody = (await res.json()) as { error?: string };
    message = typeof errorBody.error === "string" ? errorBody.error : "";
  } catch {
    // non-JSON error body
  }
  if (res.status === 401) {
    throw new Error("Please sign in to publish Paper Stish websites.");
  }
  throw new Error(message || `Publishing failed (${res.status}).`);
}
