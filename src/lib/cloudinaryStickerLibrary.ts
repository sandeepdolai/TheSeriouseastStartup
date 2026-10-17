import "server-only";

import { createHash } from "node:crypto";
import { signedUploadServerConfig } from "@/lib/uploadAuthorization";

export const STICKER_LIBRARY_FOLDER = "paper-stish/library/stickers";
const STICKER_TAG = "paper-stish-sticker";
const ALLOWED_FORMATS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

type StickerTier = "free" | "pro";

interface CloudinaryResource {
  public_id?: string;
  secure_url?: string;
  url?: string;
  width?: number;
  height?: number;
  format?: string;
  display_name?: string;
  tags?: string[];
  context?: {
    custom?: Record<string, string | undefined>;
    [key: string]: unknown;
  };
  next_cursor?: string;
}

export interface ManagedSticker {
  id: string;
  type: "sticker";
  path: string;
  name: string;
  width: number;
  height: number;
  provider: "cloudinary";
  publicId: string;
  isPro: boolean;
  tags: string[];
}

function cloudinaryRoot(): string {
  const config = signedUploadServerConfig();
  if (!config) {
    throw new Error("Cloudinary server credentials are not configured.");
  }
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}`;
}

function authHeader(): string {
  const config = signedUploadServerConfig();
  if (!config) throw new Error("Cloudinary server credentials are not configured.");
  return `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`;
}

async function cloudinaryAdminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${cloudinaryRoot()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: authHeader(),
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === "object" && payload.error &&
      typeof (payload.error as Record<string, unknown>).message === "string"
      ? String((payload.error as Record<string, unknown>).message)
      : "Cloudinary could not process the sticker library request.";
    throw new Error(message);
  }
  return payload as T;
}

function resourcePath(publicId: string): string {
  const encoded = publicId.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `/resources/image/upload/${encoded}`;
}

function safeStickerPublicId(value: string): boolean {
  return value.startsWith(`${STICKER_LIBRARY_FOLDER}/`) &&
    !value.includes("..") &&
    !value.includes("\\") &&
    value.length <= 300;
}

function customContext(resource: CloudinaryResource): Record<string, string | undefined> {
  const custom = resource.context?.custom;
  return custom && typeof custom === "object" ? custom : {};
}

function toManagedSticker(resource: CloudinaryResource): ManagedSticker | null {
  const publicId = resource.public_id;
  const url = resource.secure_url ?? resource.url;
  if (!publicId || !safeStickerPublicId(publicId) || !url || !url.startsWith("https://")) {
    return null;
  }

  const tags = Array.isArray(resource.tags) ? resource.tags : [];
  if (!tags.includes(STICKER_TAG)) return null;

  const custom = customContext(resource);
  const tier = custom.tier === "pro" || tags.includes("plan-pro") ? "pro" : "free";
  const rawName = custom.name ?? resource.display_name ?? publicId.split("/").pop() ?? "Sticker";
  const name = String(rawName).trim().slice(0, 80) || "Sticker";
  const id = `s-${createHash("sha256").update(publicId).digest("hex").slice(0, 30)}`;

  return {
    id,
    type: "sticker",
    path: url,
    name,
    width: Math.max(1, Number(resource.width) || 512),
    height: Math.max(1, Number(resource.height) || 512),
    provider: "cloudinary",
    publicId,
    isPro: tier === "pro",
    tags: tier === "pro" ? ["pro"] : [],
  };
}

/** List every published shared sticker. Plan metadata comes from Cloudinary, not the client. */
export async function listManagedStickers(): Promise<ManagedSticker[]> {
  const stickers: ManagedSticker[] = [];
  let nextCursor: string | undefined;

  // Bound paging so the public library endpoint cannot loop indefinitely.
  for (let page = 0; page < 10; page += 1) {
    const payload = await cloudinaryAdminRequest<{
      resources?: CloudinaryResource[];
      next_cursor?: string;
    }>("/resources/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expression: `tags=${STICKER_TAG}`,
        max_results: 500,
        sort_by: [{ created_at: "desc" }],
        with_field: ["context", "tags"],
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      }),
    });

    for (const resource of payload.resources ?? []) {
      const sticker = toManagedSticker(resource);
      if (sticker) stickers.push(sticker);
    }
    nextCursor = payload.next_cursor;
    if (!nextCursor) break;
  }

  return stickers;
}

/** Persist a sticker's title and Free/Pro tier directly onto its Cloudinary resource. */
export async function registerManagedSticker(
  publicId: string,
  name: string,
  tier: StickerTier,
): Promise<ManagedSticker> {
  if (!safeStickerPublicId(publicId)) {
    throw new Error("That upload is not inside the shared sticker library.");
  }

  const resource = await cloudinaryAdminRequest<CloudinaryResource>(resourcePath(publicId));
  if (resource.public_id !== publicId) {
    throw new Error("The uploaded sticker could not be verified.");
  }
  if (!ALLOWED_FORMATS.has(String(resource.format ?? "").toLowerCase())) {
    throw new Error("Stickers must be PNG, JPG, WebP, or GIF images.");
  }

  const form = new URLSearchParams();
  form.set("tags", `${STICKER_TAG},plan-${tier}`);
  // Cloudinary uses "|" and "=" as context delimiters; normalize those out of names.
  const contextName = name.replace(/[|=\\"]/g, " ").replace(/[\\u0000-\\u001f]/g, " ").trim().slice(0, 80) || "Sticker";
  form.set("context", `name=${contextName}|tier=${tier}`);

  await cloudinaryAdminRequest(resourcePath(publicId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const saved = await cloudinaryAdminRequest<CloudinaryResource>(resourcePath(publicId));
  const sticker = toManagedSticker({
    ...saved,
    context: {
      ...(saved.context ?? {}),
      custom: { ...customContext(saved), name, tier },
    },
    tags: [STICKER_TAG, `plan-${tier}`],
  });
  if (!sticker) throw new Error("Cloudinary saved the asset, but the sticker metadata could not be read.");
  return sticker;
}
