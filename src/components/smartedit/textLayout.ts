/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Shared text measurement + wrapping. BOTH the DOM renderer and the Canvas2D
   export renderer draw the exact same lines produced here, so the exported
   image matches the on-screen composition.
─────────────────────────────────────────────────────────────────────────── */

import type { TextLayer } from "./types";

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 0;
    canvas.height = 0;
    measureCtx = canvas.getContext("2d");
  }
  return measureCtx!;
}

export function canvasFontString(layer: TextLayer): string {
  return `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
}

/**
 * Wrap `text` (which may contain explicit \n) into lines that fit `maxWidth`
 * when rendered with `font`. Words longer than the width are hard-broken.
 */
export function wrapText(
  text: string,
  font: string,
  maxWidth: number,
): string[] {
  const ctx = getMeasureCtx();
  if (!ctx) return text.split("\n");

  ctx.font = font;
  const out: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      out.push("");
      continue;
    }

    // Fast path: whole paragraph fits.
    if (ctx.measureText(paragraph).width <= maxWidth) {
      out.push(paragraph);
      continue;
    }

    const words = paragraph.split(/(\s+)/);
    let line = "";

    for (const chunk of words) {
      const candidate = line + chunk;
      if (ctx.measureText(candidate).width <= maxWidth || line === "") {
        // Keep whitespace glue attached to the line while it still fits —
        // trailing spaces are trimmed at draw time via `endedSpace`.
        line = candidate;
        // Hard-break extremely long unbreakable chunks.
        while (ctx.measureText(line).width > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) {
            cut -= 1;
          }
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        out.push(line.replace(/\s+$/, ""));
        line = chunk.replace(/^\s+/, "");
      }
    }

    out.push(line.replace(/\s+$/, ""));
  }

  return out;
}

/** Wrapped lines for a text layer. Memoised by cache key. */
const wrapCache = new Map<string, string[]>();

export function layoutTextLayer(layer: TextLayer): string[] {
  const key = `${layer.fontWeight}§${layer.fontSize}§${layer.fontFamily}§${layer.width}§${layer.text}`;
  const hit = wrapCache.get(key);
  if (hit) return hit;

  const lines = wrapText(layer.text, canvasFontString(layer), layer.width);

  // Keep the cache bounded.
  if (wrapCache.size > 600) wrapCache.clear();
  wrapCache.set(key, lines);
  return lines;
}

/** Total rendered height of a text layer in design units. */
export function textLayerHeight(layer: TextLayer): number {
  const lines = layoutTextLayer(layer);
  return Math.max(1, lines.length) * layer.fontSize * layer.lineHeight;
}

/**
 * Ensure every font family/weight used by the document is loaded before
 * measurement / canvas export. Returns once all requested fonts are ready.
 */
export async function ensureFontsReady(fonts: { family: string; weight: number }[]) {
  if (typeof document === "undefined" || !document.fonts) return;
  const jobs: Promise<unknown>[] = [];
  const seen = new Set<string>();
  for (const font of fonts) {
    const key = `${font.weight} ${font.family}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      jobs.push(document.fonts.load(`${font.weight} 16px ${font.family}`));
    } catch {
      // Font loading failures fall back to the next family in the stack.
    }
  }
  await Promise.all(jobs).catch(() => undefined);
}

/**
 * Subscribe to document font lifecycle changes — the cache must be dropped
 * when fonts finish loading so layers re-measure with the real typeface.
 */
const fontListeners = new Set<() => void>();
let fontHooked = false;

export function onFontsChanged(cb: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  if (!fontHooked && document.fonts) {
    fontHooked = true;
    document.fonts.addEventListener("loadingdone", () => {
      wrapCache.clear();
      fontListeners.forEach((fn) => fn());
    });
  }
  fontListeners.add(cb);
  return () => fontListeners.delete(cb);
}
