/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — client adapter for server-authorized Cloudinary uploads.

   The browser never holds Cloudinary credentials. For every publish-time
   upload it first asks POST /api/uploads/authorize (session-scoped, quota
   checked, destination chosen by the server), then uploads the file to
   Cloudinary with exactly the parameters the server signed. The signature
   covers folder + public_id + upload_preset + timestamp, so the request —
   and therefore where the asset lands — cannot be altered from the client.

   Device-first editing is untouched: these helpers run ONLY inside publish
   dialogs, never while the user is editing.
─────────────────────────────────────────────────────────────────────────── */

import type { SignedUploadPurpose } from "@/lib/uploadAuthorization";

/** What the authorize endpoint hands back for one upload. */
export interface UploadGrant {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  folder: string;
  /** Short public_id parameter to send (Cloudinary composes the final id). */
  uploadPublicId: string;
  /** Final public id the uploaded asset will carry. */
  publicId: string;
  timestamp: number;
  signature: string;
  expiresAt: number;
}

/** Result shape shared with the editor's CloudinaryUpload. */
export interface SignedCloudinaryUpload {
  url: string;
  width: number;
  height: number;
  publicId: string;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // non-JSON error body
  }
  return fallback;
}

/** Ask the server for one signed upload authorization. */
export async function requestUploadGrant(
  purpose: SignedUploadPurpose,
  projectId?: string,
): Promise<UploadGrant> {
  let response: Response;
  try {
    response = await fetch("/api/uploads/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, ...(projectId ? { projectId } : {}) }),
    });
  } catch {
    throw new Error("Could not reach the Paper Stish server. Check your connection and try again.");
  }
  if (!response.ok) {
    throw await readError(response, "Photo storage is not available right now. Try again in a moment.");
  }
  const data = (await response.json()) as { uploads?: UploadGrant[] };
  const grant = data.uploads?.[0];
  if (!grant) throw new Error("Photo storage did not authorize the upload. Try again.");
  return grant;
}

/** Upload one blob with a server-signed grant. No client credentials exist. */
export async function uploadWithGrant(
  blob: Blob,
  grant: UploadGrant,
): Promise<SignedCloudinaryUpload> {
  const form = new FormData();
  form.append("file", blob);
  // Exactly the parameters the server signed — Cloudinary rejects any
  // addition or modification of signable params. The final asset id is
  // composed by Cloudinary as <folder>/<uploadPublicId>.
  form.append("api_key", grant.apiKey);
  form.append("timestamp", String(grant.timestamp));
  form.append("upload_preset", grant.uploadPreset);
  form.append("folder", grant.folder);
  form.append("public_id", grant.uploadPublicId);
  form.append("signature", grant.signature);

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(grant.cloudName)}/image/upload`,
      { method: "POST", body: form },
    );
  } catch {
    throw new Error("Could not reach photo storage. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error("Photo storage rejected the upload. Try again in a moment.");
  }
  const data = (await response.json()) as {
    secure_url?: string;
    url?: string;
    width?: number;
    height?: number;
    public_id?: string;
  };
  const url = data.secure_url ?? data.url;
  if (!url) throw new Error("Photo storage did not return the uploaded photo. Try again.");
  return {
    url,
    width: data.width ?? 0,
    height: data.height ?? 0,
    publicId: data.public_id ?? grant.publicId,
  };
}

/** authorize → upload, in one step (the publish dialogs' workhorse). */
export async function authorizedUpload(
  blob: Blob,
  purpose: SignedUploadPurpose,
  projectId?: string,
): Promise<SignedCloudinaryUpload> {
  return uploadWithGrant(blob, await requestUploadGrant(purpose, projectId));
}
