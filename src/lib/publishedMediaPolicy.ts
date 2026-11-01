/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — published-media storage policy.

   Published websites must keep binary media OUT of PostgreSQL: when
   Cloudinary is configured for the deployment, every image published in a
   website (Smart Edit layers and normal-template photos) must already live
   at a durable URL — a Cloudinary delivery URL or a bundled public asset —
   before POST /api/publish accepts the snapshot. Embedded base64 photos are
   a legacy fallback used only when Cloudinary is not configured (local
   development), and they are bounded by the request-size limits.

   Reference policy (server-side, publish time): media on the deployment's
   own Cloudinary cloud must live where the SERVER put it — under the
   publishing user's own namespace (paper-stish/published-websites/u/<id>/…,
   the destination every signed upload is scoped to) or in a shared legacy
   namespace (pre-authorization-era paths and admin template assets). A URL
   under another user's namespace is rejected, so an authorization can never
   be used to publish someone else's assets.

   This module is intentionally dependency-free and client + server safe so
   the exact same rules can run on both sides, and so it can be unit-tested
   with the plain Node test runner (tests/*.test.mts).
─────────────────────────────────────────────────────────────────────────── */

/** True when the SERVER-side Cloudinary credentials are present: publish
 *  policy (reject embedded media) only activates for real deployments. */
export function cloudinaryMediaConfigured(): boolean {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME)?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

/** The cloud the deployment publishes media to (empty when unconfigured). */
export function deploymentCloudName(): string {
  return (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME ||
    ""
  ).trim();
}

const DATA_IMAGE_RE = /^data:image\//i;
const DATA_VIDEO_RE = /^data:video\//i;

/** True for embedded base64 image payloads (the storage we must reject). */
export function isEmbeddedImage(value: unknown): value is string {
  return typeof value === "string" && DATA_IMAGE_RE.test(value);
}

/** True for embedded base64 video payloads. */
export function isEmbeddedVideo(value: unknown): value is string {
  return typeof value === "string" && DATA_VIDEO_RE.test(value);
}

/** Any binary media embedded directly in publication values. */
export function isEmbeddedMedia(value: unknown): value is string {
  return isEmbeddedImage(value) || isEmbeddedVideo(value);
}

export interface SmartEditDocumentLike {
  layers?: Array<{ type?: string; url?: string }>;
  fonts?: Array<{ source?: string; dataUrl?: string }>;
}

export interface TemplateValuesLike {
  photoUrl?: string | null;
  images?: string[];
  memoryLaneProfiles?: Array<{ photoUrl?: string | null }>;
  memoryLaneMedia?: Array<{ type?: string; url?: string }>;
}

/** Count embedded base64 IMAGES in a Smart Edit document.
 *  User fonts (font.dataUrl) are intentionally not images and stay allowed —
 *  embedding fonts in the snapshot is the established design so visitors
 *  never depend on the author's device. */
export function smartEditEmbeddedImageCount(document: SmartEditDocumentLike): number {
  let count = 0;
  for (const layer of document.layers ?? []) {
    if (layer.type !== "image" && layer.type !== "sticker") continue;
    if (isEmbeddedImage(layer.url)) count += 1;
  }
  return count;
}

/** Count embedded base64 photos in normal-template values. */
export function templateValuesEmbeddedImageCount(values: TemplateValuesLike): number {
  let count = 0;
  if (isEmbeddedImage(values.photoUrl)) count += 1;
  for (const image of values.images ?? []) {
    if (isEmbeddedImage(image)) count += 1;
  }
  for (const profile of values.memoryLaneProfiles ?? []) {
    if (isEmbeddedImage(profile.photoUrl)) count += 1;
  }
  for (const media of values.memoryLaneMedia ?? []) {
    if (isEmbeddedMedia(media.url)) count += 1;
  }
  return count;
}

/** Human-readable storage-policy error for the publish API. */
export function embeddedMediaError(count: number): string {
  return (
    `This website has ${count} media ${count === 1 ? "file" : "files"} still stored on your device. ` +
    "Cloud storage must be available to publish it — check your connection and try again."
  );
}

/* ── Cloudinary reference policy ────────────────────────────────────────── */

export const USER_MEDIA_PREFIX = "paper-stish/published-websites/u/";
/** Namespaces that predate per-user authorization (read-only grace: no new
 *  uploads land here, but existing publications referencing them — and
 *  admin template assets — keep working). */
export const LEGACY_MEDIA_PREFIXES = [
  "paper-stish/published-websites/",
  "paper-stish/user-assets/",
  "paper-stish/templates/",
] as const;

/**
 * Canonical delivery URL of the deployment's cloud:
 *   https://res.cloudinary.com/<cloud>/image/upload/v<digits>/<public_id>.<ext>
 * Returns the public_id, or null for anything else (other clouds, non-image
 * delivery, transformed URLs are not enforceable and are treated as foreign
 * https URLs — allowed by validation but never confused with our storage).
 */
export function cloudinaryPublicIdFromUrl(url: string, cloudName: string): string | null {
  if (!cloudName) return null;
  const re = new RegExp(
    `^https://res\\.cloudinary\\.com/${cloudName.replace(/[^a-zA-Z0-9_-]/g, "")}/(?:image|video)/upload/v\\d+/(.+)\\.[a-zA-Z0-9]+$`,
  );
  const match = re.exec(url);
  return match ? match[1] : null;
}

/** True when the public_id is where the SERVER would have put it for this
 *  user (their own namespace) or in a shared legacy namespace. */
export function isAuthorizedMediaReference(publicId: string, userId: string): boolean {
  if (publicId.startsWith(USER_MEDIA_PREFIX)) {
    return publicId.startsWith(`${USER_MEDIA_PREFIX}${userId}/`);
  }
  return LEGACY_MEDIA_PREFIXES.some((prefix) => publicId.startsWith(prefix));
}

function unauthorizedReferences(urls: string[], cloudName: string, userId: string): string[] {
  const offenders: string[] = [];
  for (const url of urls) {
    const publicId = cloudinaryPublicIdFromUrl(url, cloudName);
    if (publicId && !isAuthorizedMediaReference(publicId, userId)) offenders.push(publicId);
  }
  return offenders;
}

/** Offending Cloudinary public_ids in a Smart Edit document (foreign user
 *  namespaces / unexpected namespaces on our cloud). */
export function smartEditUnauthorizedReferences(
  document: SmartEditDocumentLike,
  cloudName: string,
  userId: string,
): string[] {
  const urls: string[] = [];
  for (const layer of document.layers ?? []) {
    if (layer.type !== "image" && layer.type !== "sticker") continue;
    if (typeof layer.url === "string" && !isEmbeddedImage(layer.url)) urls.push(layer.url);
  }
  return unauthorizedReferences(urls, cloudName, userId);
}

/** Offending Cloudinary public_ids in normal-template values. */
export function templateValuesUnauthorizedReferences(
  values: TemplateValuesLike,
  cloudName: string,
  userId: string,
): string[] {
  const urls: string[] = [];
  if (typeof values.photoUrl === "string" && !isEmbeddedImage(values.photoUrl)) {
    urls.push(values.photoUrl);
  }
  for (const image of values.images ?? []) {
    if (typeof image === "string" && image.length > 0 && !isEmbeddedImage(image)) urls.push(image);
  }
  for (const profile of values.memoryLaneProfiles ?? []) {
    if (typeof profile.photoUrl === "string" && !isEmbeddedImage(profile.photoUrl)) urls.push(profile.photoUrl);
  }
  for (const media of values.memoryLaneMedia ?? []) {
    if (typeof media.url === "string" && !isEmbeddedMedia(media.url)) urls.push(media.url);
  }
  return unauthorizedReferences(urls, cloudName, userId);
}

/** Human-readable reference-policy error for the publish API. */
export function unauthorizedMediaError(count: number): string {
  return (
    `This website references ${count === 1 ? "a media file" : `${count} media files`} that do not belong to your account. ` +
    "Re-add the photos or videos from your device and try again."
  );
}

