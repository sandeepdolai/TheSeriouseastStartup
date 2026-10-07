/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Publish model.

   Publishing is SERVER-BACKED: the editor saves the project, then asks the
   server to create/update a publication record. The public link is small —

     /{username}/{viewerName}/{templateId}

   — and the viewer loads the published document from
   /api/smart-edit/published/{templateId}. The document payload is never
   placed in the URL.

   The base64 #data= encoding is still understood by the viewer so links
   produced by the earlier client-only version keep working.

   This module has no "use client" directive and uses no browser-only APIs
   at module scope, so the same validation runs on the server (API routes)
   and in the browser.
─────────────────────────────────────────────────────────────────────────── */

import type { Layer, SmartEditDocument, TextLayer } from "./types";
import { slugPart } from "@/lib/slug";

export { slugPart };

export interface SmartEditPublishedPayload {
  version: 1;
  templateSlug: "smart-edit";
  title: string;
  publishedAt: string;
  document: SmartEditDocument;
}

export interface PublishedRecord {
  username: string;
  viewerName: string;
  templateId: string;
  url: string;
  publishedAt: string;
}

/** Maximum serialized document size accepted for saving/publishing. */
export const SMART_EDIT_MAX_DOCUMENT_BYTES = 4_000_000;

/* ── Encoding (legacy client-side links) ────────────────────────────────── */

export function encodeSmartEditPayload(payload: SmartEditPublishedPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* ── Validation (shared by the viewer, the editor and the API routes) ───── */

const URL_RE = /^(https?:\/\/[^\s"'<>]+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+|\/[^\s"'<>]*)$/;
const FONT_DATA_RE = /^data:(?:font|application)\/[a-z0-9.+-]*;base64,[A-Za-z0-9+/=]+$/;
const FAMILY_RE = /^[\w ,'"-]{1,80}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const LAYER_TYPES = new Set(["text", "image", "sticker"]);
const MAX_LAYERS = 200;

function str(value: unknown, max = 300): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

function num(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function safeLayer(raw: unknown): Layer | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  const type = str(l.type, 16);
  if (!type || !LAYER_TYPES.has(type)) return null;

  const base = {
    id: str(l.id, 64) ?? "",
    type: type as Layer["type"],
    x: num(l.x, -100000, 100000) ?? 0,
    y: num(l.y, -100000, 100000) ?? 0,
    width: num(l.width, 0, 100000) ?? 100,
    height: num(l.height, 0, 100000) ?? 100,
    rotation: num(l.rotation, -3600, 3600) ?? 0,
    opacity: num(l.opacity, 0, 1) ?? 1,
    visible: l.visible !== false,
    locked: l.locked === true,
  };
  if (!base.id) return null;

  if (type === "text") {
    const t = l as Record<string, unknown>;
    const align = t.align === "left" || t.align === "right" ? t.align : "center";
    const layer: TextLayer = {
      ...base,
      type: "text",
      text: str(t.text, 2000) ?? "",
      fontId: str(t.fontId, 64) ?? "diatype",
      fontFamily: FAMILY_RE.test(String(t.fontFamily ?? "")) ? String(t.fontFamily) : "sans",
      fontSize: num(t.fontSize, 4, 800) ?? 40,
      fontWeight: num(t.fontWeight, 100, 1000) ?? 400,
      color: COLOR_RE.test(String(t.color ?? "")) ? String(t.color) : "#000000",
      align,
      lineHeight: num(t.lineHeight, 0.7, 3) ?? 1.2,
    };
    return layer;
  }

  const url = str(l.url, 200000);
  if (!url || !URL_RE.test(url)) return null;
  const naturalW = num((l.natural as Record<string, unknown> | undefined)?.width, 0, 100000) ?? 100;
  const naturalH = num((l.natural as Record<string, unknown> | undefined)?.height, 0, 100000) ?? 100;
  return {
    ...base,
    type: type as "image" | "sticker",
    assetId: str(l.assetId, 64) ?? "",
    url,
    natural: { width: naturalW, height: naturalH },
  };
}

function safeDocument(raw: unknown): SmartEditDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const canvasW = num(d.canvas && (d.canvas as Record<string, unknown>).width, 1, 5000);
  const canvasH = num(d.canvas && (d.canvas as Record<string, unknown>).height, 1, 5000);
  if (!canvasW || !canvasH) return null;

  const bg = d.background as Record<string, unknown> | undefined;
  const background = {
    type: "color" as const,
    color: bg && COLOR_RE.test(String(bg.color ?? "")) ? String(bg.color) : "#f4efe6",
  };

  if (!Array.isArray(d.layers) || d.layers.length > MAX_LAYERS) return null;
  const layers = d.layers.map(safeLayer).filter((layer): layer is Layer => layer !== null);

  const fonts: SmartEditDocument["fonts"] = [];
  if (Array.isArray(d.fonts)) {
    for (const rawFont of d.fonts.slice(0, 24)) {
      const f = rawFont as Record<string, unknown>;
      const id = str(f.id, 64);
      const family = str(f.family, 80);
      if (!id || !family || !FAMILY_RE.test(family)) continue;
      if (f.source === "builtin") {
        fonts.push({ id, family, source: "builtin" });
      } else if (typeof f.dataUrl === "string" && FONT_DATA_RE.test(f.dataUrl) && f.dataUrl.length < 8_000_000) {
        fonts.push({ id, family, source: "user", dataUrl: f.dataUrl });
      }
    }
  }

  return {
    version: 1,
    canvas: { width: canvasW, height: canvasH },
    background,
    layers,
    fonts,
  };
}

/** Validate an untrusted parsed document (same rules everywhere). */
export function validateSmartEditDocument(raw: unknown): SmartEditDocument | null {
  return safeDocument(raw);
}

/** Validate an untrusted parsed publish payload. */
export function validateSmartEditPayload(raw: unknown): SmartEditPublishedPayload | null {
  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return null;
  }
  const parsed = raw as Record<string, unknown>;
  if (parsed.version !== 1 || parsed.templateSlug !== "smart-edit") return null;

  const document = safeDocument(parsed.document);
  if (!document) return null;

  return {
    version: 1,
    templateSlug: "smart-edit",
    title: str(parsed.title, 120) ?? "Smart Edit",
    publishedAt: str(parsed.publishedAt, 40) ?? new Date().toISOString(),
    document,
  };
}

/* ── Decoding (viewer side — never trust the URL) ────────────────────────── */

export function decodeSmartEditPayload(value: string): SmartEditPublishedPayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return validateSmartEditPayload(parsed);
  } catch {
    return null;
  }
}

/* ── URL construction ────────────────────────────────────────────────────── */

/**
 * Public website URL — /{username}/{viewerName}/{templateId}.
 * The published document is fetched from the server by templateId; nothing
 * is appended to the URL.
 */
export function buildPublicUrl(username: string, viewerName: string, templateId: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = `${basePath}/${username}/${viewerName}/${templateId}`;
  return window.location.origin + path;
}

/** Estimated serialized size — used for friendly pre-flight size errors. */
export function estimateDocumentBytes(document: SmartEditDocument): number {
  return new TextEncoder().encode(JSON.stringify(document)).length;
}
