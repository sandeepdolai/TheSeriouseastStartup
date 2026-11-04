/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — publish-time Cloudinary uploads for normal templates.

   The normal website templates (Birthday, Love of My Life, Photo Album,
   Love Heart) keep photos on the user's device while editing (device-first
   model — see lib/localProjects.ts). When the user presses Publish, this
   module moves the data-URL photos the snapshot needs to Cloudinary, so the
   server never persists base64 image bytes in PostgreSQL.

   Every upload is SERVER-AUTHORIZED: the browser first asks
   POST /api/uploads/authorize (session + quota checked server-side), which
   returns Cloudinary parameters signed with the server-only API secret and
   scoped to the user's own namespace. The client holds no Cloudinary
   credentials. When Cloudinary is not configured the helpers here are inert
   and publishing falls back to the bounded embedded-photo path for local
   development.
─────────────────────────────────────────────────────────────────────────── */

import type { TemplatePublicationValues } from "@/lib/publications";
import { authorizedUpload } from "@/lib/signedCloudinaryUpload";

/** Matches the editor's input bound (assets.ts IMAGE_MAX_INPUT_BYTES). */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function cloudinaryClientConfig(): { cloudName: string } | null {
  const cloudName = process.env.NEXT_PUBLIC_SMART_EDIT_CLOUDINARY_CLOUD_NAME?.trim();
  return cloudName ? { cloudName } : null;
}

/** Decode a base64 image data URL into a Blob (browser + Node compatible). */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Could not read the photo for publishing.");
  const meta = dataUrl.slice(5, comma); // "image/webp;base64"
  const mime = meta.split(";")[0] || "image/webp";
  const base64 = dataUrl.slice(comma + 1);
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("That media file is too large (100 MB max). Use a smaller file.");
  }
  return new Blob([bytes], { type: mime });
}

/** Upload one data-URL image through the server-authorized signed flow. */
export async function uploadDataUrlToCloudinary(
  dataUrl: string,
  resourceType: "image" | "video" = "image",
): Promise<string> {
  const uploaded = await authorizedUpload(dataUrlToBlob(dataUrl), "template-photos", undefined, resourceType);
  return uploaded.url;
}

/**
 * Replace embedded base64 photos in template values with durable Cloudinary
 * URLs (publish-time only — the device-local edit state is not touched).
 * Returns the values unchanged when Cloudinary is not configured.
 */
export async function durableTemplateValues(
  values: TemplatePublicationValues,
): Promise<TemplatePublicationValues> {
  if (!cloudinaryClientConfig()) return values;

  const next: TemplatePublicationValues = { ...values };

  if (typeof next.photoUrl === "string" && next.photoUrl.startsWith("data:")) {
    next.photoUrl = await uploadDataUrlToCloudinary(next.photoUrl);
  }

  if (Array.isArray(next.images)) {
    const images: string[] = [];
    for (const image of next.images) {
      images.push(
        typeof image === "string" && image.startsWith("data:")
          ? await uploadDataUrlToCloudinary(image)
          : image,
      );
    }
    next.images = images;
  }

  if (Array.isArray(next.memoryLaneProfiles)) {
    const profiles: NonNullable<TemplatePublicationValues["memoryLaneProfiles"]> = [];
    for (const profile of next.memoryLaneProfiles) {
      const photoUrl = typeof profile.photoUrl === "string" && profile.photoUrl.startsWith("data:")
        ? await uploadDataUrlToCloudinary(profile.photoUrl)
        : profile.photoUrl;
      profiles.push({ ...profile, photoUrl });
    }
    next.memoryLaneProfiles = profiles;
  }

  if (next.memoryLaneVideoProject) {
    const media: NonNullable<TemplatePublicationValues["memoryLaneVideoProject"]>["media"] = {};
    for (const [key, asset] of Object.entries(next.memoryLaneVideoProject.media)) {
      const src = typeof asset.src === "string" && asset.src.startsWith("data:")
        ? await uploadDataUrlToCloudinary(asset.src, asset.k === "i" ? "image" : "video")
        : asset.src;
      media[key] = { ...asset, src };
    }
    next.memoryLaneVideoProject = { ...next.memoryLaneVideoProject, media };
  }

  return next;
}
