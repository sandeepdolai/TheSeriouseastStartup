"use client";

import { slugPart } from "@/lib/slug";

/**
 * Legacy client-side publishing format (base64 payload in the #data=
 * fragment). Kept ONLY so previously published links keep decoding —
 * every new publication is stored server-side and resolved through
 * /{username}/{viewerName}/{templateId} (see lib/publications.ts).
 */

export interface PublishedTemplatePayload {
  version: 1;
  templateSlug: string;
  title: string;
  heading: string;
  message: string;
  photoUrl: string | null;
  data?: Record<string, string | null>;
  publishedAt: string;
}

/** Legacy encoder — no longer used for new publications. */
export function encodePublishedPayload(payload: PublishedTemplatePayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodePublishedPayload(value: string): PublishedTemplatePayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);

    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.templateSlug !== "string" ||
      typeof parsed.heading !== "string" ||
      typeof parsed.message !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      templateSlug: parsed.templateSlug,
      title: typeof parsed.title === "string" ? parsed.title : "Paper Stish",
      heading: parsed.heading,
      message: parsed.message,
      photoUrl: typeof parsed.photoUrl === "string" ? parsed.photoUrl : null,
      data:
        parsed.data && typeof parsed.data === "object"
          ? (Object.fromEntries(
              Object.entries(parsed.data as Record<string, unknown>).filter(
                ([, value]) => typeof value === "string" || value === null,
              ),
            ) as Record<string, string | null>)
          : undefined,
      publishedAt:
        typeof parsed.publishedAt === "string"
          ? parsed.publishedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export { slugPart };
