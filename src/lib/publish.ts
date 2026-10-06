"use client";

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
          ? Object.fromEntries(
              Object.entries(parsed.data).filter(
                ([, value]) => typeof value === "string" || value === null,
              ),
            )
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

export function slugPart(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || fallback;
}

export function createTemplateId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 2; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return "1" + suffix;
}
