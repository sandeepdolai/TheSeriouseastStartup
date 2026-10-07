/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Publish payload. Follows the existing Paper Stish publishing architecture:
   a clean public URL (/{username}/{viewer}/{templateId}) whose fragment
   carries the encoded document — the same #data= convention the template
   system already uses, so no server is required for the public viewer.

   Smart Edit payloads are self-contained: every asset is resolved to an
   absolute or data url and user fonts are embedded, so the viewer needs no
   storage or account access.
─────────────────────────────────────────────────────────────────────────── */

import type { Layer, SmartEditDocument, TextLayer } from "./types";
import { createTemplateId, slugPart } from "@/lib/publish";

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

export { createTemplateId, slugPart };

/* ── Encoding ───────────────────────────────────────────────────────────── */

export function encodeSmartEditPayload(payload: SmartEditPublishedPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* ── Decoding + strict validation (viewer side — never trust the URL) ────── */

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

export function decodeSmartEditPayload(value: string): SmartEditPublishedPayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));

    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.templateSlug !== "smart-edit" ||
      !parsed.document ||
      typeof parsed.document !== "object"
    ) {
      return null;
    }

    const d = parsed.document as Record<string, unknown>;
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
      for (const raw of d.fonts.slice(0, 24)) {
        const f = raw as Record<string, unknown>;
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
      templateSlug: "smart-edit",
      title: str(parsed.title, 120) ?? "Smart Edit",
      publishedAt: str(parsed.publishedAt, 40) ?? new Date().toISOString(),
      document: {
        version: 1,
        canvas: { width: canvasW, height: canvasH },
        background,
        layers,
        fonts,
      },
    };
  } catch {
    return null;
  }
}

/* ── URL construction (same convention as the template system) ──────────── */

export function buildPublicUrl(username: string, viewerName: string, templateId: string, payload: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = `${basePath}/${username}/${viewerName}/${templateId}`;
  return window.location.origin + path + "#data=" + payload;
}

/** Estimated encoded size — publish warns before producing huge links. */
export function estimatePayloadBytes(payload: SmartEditPublishedPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}
