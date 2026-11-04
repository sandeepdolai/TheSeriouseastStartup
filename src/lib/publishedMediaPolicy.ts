/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — published-media storage policy.

   Published website media must be durable before it is stored in PostgreSQL.
   Cloudinary uploads are scoped to the publishing user's namespace; foreign
   references to this deployment's Cloudinary cloud are rejected.
─────────────────────────────────────────────────────────────────────────── */

export function cloudinaryMediaConfigured(): boolean {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME)?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export function deploymentCloudName(): string {
  return (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME ||
    ""
  ).trim();
}

const DATA_IMAGE_RE = /^data:image\//i;
const DATA_MEDIA_RE = /^data:(?:image|video|audio)\//i;

export function isEmbeddedImage(value: unknown): value is string {
  return typeof value === "string" && DATA_IMAGE_RE.test(value);
}

export interface SmartEditDocumentLike {
  layers?: Array<{ type?: string; url?: string }>;
  fonts?: Array<{ source?: string; dataUrl?: string }>;
}

export interface TemplateValuesLike {
  photoUrl?: string | null;
  images?: string[];
  memoryLaneProfiles?: Array<{ photoUrl?: string | null }>;
  memoryLaneVideoProject?: { media?: Record<string, { src?: string }> };
}

export function smartEditEmbeddedImageCount(document: SmartEditDocumentLike): number {
  let count = 0;
  for (const layer of document.layers ?? []) {
    if (layer.type !== "image" && layer.type !== "sticker") continue;
    if (isEmbeddedImage(layer.url)) count += 1;
  }
  return count;
}

export function templateValuesEmbeddedImageCount(values: TemplateValuesLike): number {
  let count = 0;
  if (isEmbeddedImage(values.photoUrl)) count += 1;
  for (const image of values.images ?? []) {
    if (isEmbeddedImage(image)) count += 1;
  }
  for (const profile of values.memoryLaneProfiles ?? []) {
    if (isEmbeddedImage(profile.photoUrl)) count += 1;
  }
  return count;
}

export function templateValuesEmbeddedMediaCount(values: TemplateValuesLike): number {
  let count = templateValuesEmbeddedImageCount(values);
  for (const asset of Object.values(values.memoryLaneVideoProject?.media ?? {})) {
    if (typeof asset?.src === "string" && DATA_MEDIA_RE.test(asset.src)) count += 1;
  }
  return count;
}

export function embeddedMediaError(count: number): string {
  return (
    `This website has ${count === 1 ? "a media file that is" : `${count} media files that are`} still stored on your device. ` +
    "Cloud storage must be available to publish it — check your connection and try again."
  );
}

export const USER_MEDIA_PREFIX = "paper-stish/published-websites/u/";
export const LEGACY_MEDIA_PREFIXES = [
  "paper-stish/published-websites/",
  "paper-stish/user-assets/",
  "paper-stish/templates/",
] as const;

/**
 * Accept canonical Cloudinary image or video delivery URLs. Return the
 * public_id so callers can enforce the publishing user's namespace.
 */
export function cloudinaryPublicIdFromUrl(url: string, cloudName: string): string | null {
  if (!cloudName) return null;
  const safeCloudName = cloudName.replace(/[^a-zA-Z0-9_-]/g, "");
  const re = new RegExp(
    `^https://res\\.cloudinary\\.com/${safeCloudName}/(?:image|video)/upload/v\\d+/(.+)\\.[a-zA-Z0-9]+$`,
  );
  const match = re.exec(url);
  return match ? match[1] : null;
}

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
  for (const asset of Object.values(values.memoryLaneVideoProject?.media ?? {})) {
    if (typeof asset?.src === "string" && !DATA_MEDIA_RE.test(asset.src)) urls.push(asset.src);
  }
  return unauthorizedReferences(urls, cloudName, userId);
}

export function unauthorizedMediaError(count: number): string {
  return (
    `This website references ${count === 1 ? "a media file" : `${count} media files`} that do not belong to your account. ` +
    "Re-add the media from your device and try again."
  );
}
