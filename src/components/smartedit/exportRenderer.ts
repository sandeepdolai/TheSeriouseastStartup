/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Canvas2D export renderer. Re-draws the document model at full resolution —
   artwork only, no editor chrome — sharing the text layout engine with the
   on-screen renderer so the export matches the composition.
─────────────────────────────────────────────────────────────────────────── */

import type { ImageLikeLayer, SmartEditDocument, TextLayer } from "./types";
import { ensureFontsReady, layoutTextLayer } from "./textLayout";
import { assetUrl } from "./assets";

export interface ExportOptions {
  format: "png" | "jpg";
  scale: number;
}

function resolveLayerUrl(layer: ImageLikeLayer): string | undefined {
  if (layer.url && /^(https?:|data:|blob:)/.test(layer.url)) return layer.url;
  return assetUrl(layer.assetId);
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderDocumentToCanvas(
  doc: SmartEditDocument,
  options: ExportOptions,
): Promise<HTMLCanvasElement> {
  const { width, height } = doc.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * options.scale);
  canvas.height = Math.round(height * options.scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the export canvas.");

  ctx.scale(options.scale, options.scale);

  // 1. Fonts must be loaded before measuring / drawing text.
  const textLayers = doc.layers.filter(
    (layer): layer is TextLayer => layer.type === "text" && layer.visible,
  );
  await ensureFontsReady(
    textLayers.map((layer) => ({ family: layer.fontFamily, weight: layer.fontWeight })),
  );

  // 2. Preload every visible image.
  const imageLayers = doc.layers.filter(
    (layer): layer is ImageLikeLayer =>
      (layer.type === "image" || layer.type === "sticker") && layer.visible,
  );
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    imageLayers.map(async (layer) => {
      const url = resolveLayerUrl(layer);
      if (!url) return;
      const img = await loadImage(url);
      if (img) images.set(layer.id, img);
    }),
  );

  // 3. Background.
  ctx.fillStyle = doc.background.type === "color" ? doc.background.color : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // 4. Layers in z-order.
  for (const layer of doc.layers) {
    if (!layer.visible) continue;

    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.globalAlpha = layer.opacity;

    if (layer.type === "text") {
      const lines = layoutTextLayer(layer);
      ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.textBaseline = "middle";
      ctx.textAlign = layer.align;
      const lineBox = layer.fontSize * layer.lineHeight;
      lines.forEach((line, index) => {
        const y = (index + 0.5) * lineBox;
        const x = layer.align === "left" ? -layer.width / 2 : layer.align === "right" ? layer.width / 2 : 0;
        ctx.fillText(line, x, y);
      });
    } else {
      const img = images.get(layer.id);
      if (img) {
        ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
      }
    }

    ctx.restore();
  }

  return canvas;
}

export async function exportDocument(
  doc: SmartEditDocument,
  options: ExportOptions,
): Promise<void> {
  const canvas = await renderDocumentToCanvas(doc, options);
  const mime = options.format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, options.format === "png" ? undefined : 0.92),
  );
  if (!blob) throw new Error("Could not export the image.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smart-edit-${Date.now()}.${options.format}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
