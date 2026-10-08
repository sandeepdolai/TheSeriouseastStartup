/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Document / layer model. Everything is expressed in DESIGN UNITS relative to
   the document canvas (e.g. 1080×1350). Rendering layers with CSS % / cqh
   units lets one component draw the document at ANY pixel size (editor,
   My Projects preview, public viewer) with zero re-measurement.
─────────────────────────────────────────────────────────────────────────── */

export type LayerType = "text" | "image" | "sticker";

export interface BaseLayer {
  id: string;
  type: LayerType;
  /** position of the layer CENTER in design units */
  x: number;
  y: number;
  /** layer box in design units (for text: width = wrap width, height derived) */
  width: number;
  height: number;
  /** degrees, clockwise */
  rotation: number;
  /** 0..1 */
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  /** font registry id (see BUILTIN_FONTS / user fonts) */
  fontId: string;
  /** CSS/canvas font family string, kept for standalone rendering */
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
}

/**
 * Non-destructive image crop. The rect is NORMALISED (0..1) over the
 * ROTATED image space — the coordinate frame of the original image after
 * `rotation` degrees clockwise (for 90° steps this is just the swapped
 * axes; normalised units keep the crop independent of the asset's pixel
 * resolution, device pixel ratio and any future re-compression).
 *
 *   original image (W×H)
 *     ⇅ rotate by `rotation` around its centre
 *   rotated space (W'×H' bounding box)
 *     ⇎ crop rect {x, y, width, height} — normalised over W'×H'
 *
 * `undefined` means "no crop" — the whole (unrotated) image is visible.
 * The original asset is never modified; Reset simply removes the crop.
 */
export interface CropState {
  /** left edge of the visible rect, normalised over the rotated width */
  x: number;
  /** top edge of the visible rect, normalised over the rotated height */
  y: number;
  /** visible width, normalised over the rotated width (0 < width ≤ 1) */
  width: number;
  /** visible height, normalised over the rotated height (0 < height ≤ 1) */
  height: number;
  /** image-content rotation inside the crop, degrees clockwise.
   *  The UI produces multiples of 90; the render math is general. */
  rotation: number;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  assetId: string;
  /** resolved url at save/publish time; editors resolve via asset registry */
  url: string;
  natural: { width: number; height: number };
  /** non-destructive crop — absent means the uncropped image */
  crop?: CropState;
}

export interface StickerLayer extends BaseLayer {
  type: "sticker";
  assetId: string;
  url: string;
  natural: { width: number; height: number };
}

export type Layer = TextLayer | ImageLayer | StickerLayer;
export type ImageLikeLayer = ImageLayer | StickerLayer;

export interface DocumentBackground {
  type: "color";
  color: string;
}

export interface FontRef {
  /** registry id */
  id: string;
  family: string;
  /** "builtin" fonts ship with Paper Stish; "user" fonts were imported */
  source: "builtin" | "user";
  /** data url — only present for user fonts in self-contained documents */
  dataUrl?: string;
}

export interface SmartEditDocument {
  version: 1;
  canvas: { width: number; height: number };
  background: DocumentBackground;
  /** array order == z-order (last = topmost) */
  layers: Layer[];
  /** user-imported fonts referenced by text layers */
  fonts: FontRef[];
}

/* ── Canvas presets ─────────────────────────────────────────────────────── */

export type CanvasRatio = "4:5" | "1:1" | "9:16" | "16:9";

export const CANVAS_RATIOS: Record<
  CanvasRatio,
  { width: number; height: number; label: string; hint: string }
> = {
  "4:5": { width: 1080, height: 1350, label: "4:5", hint: "Post" },
  "1:1": { width: 1080, height: 1080, label: "1:1", hint: "Square" },
  "9:16": { width: 1080, height: 1920, label: "9:16", hint: "Story" },
  "16:9": { width: 1920, height: 1080, label: "16:9", hint: "Wide" },
};

export function createDocument(ratio: CanvasRatio): SmartEditDocument {
  const preset = CANVAS_RATIOS[ratio];
  return {
    version: 1,
    canvas: { width: preset.width, height: preset.height },
    background: { type: "color", color: "#f4efe6" },
    layers: [],
    fonts: [],
  };
}

/* ── Built-in font registry (fonts already shipped with Paper Stish) ────── */

export interface FontDef {
  id: string;
  /** CSS font-family stack (quoted where needed) */
  family: string;
  name: string;
  weights: number[];
  category: "sans" | "display" | "handwriting" | "script";
}

export const BUILTIN_FONTS: FontDef[] = [
  {
    id: "diatype",
    family: "sans",
    name: "Diatype",
    weights: [300, 400, 500, 600, 700],
    category: "sans",
  },
  {
    id: "oswald",
    family: "'Oswald'",
    name: "Oswald",
    weights: [400, 500, 600, 700],
    category: "display",
  },
  {
    id: "anton",
    family: "'Anton'",
    name: "Anton",
    weights: [400],
    category: "display",
  },
  {
    id: "dancing",
    family: "'Dancing Script'",
    name: "Dancing Script",
    weights: [500, 600, 700],
    category: "script",
  },
  {
    id: "caveat",
    family: "'Caveat Brush'",
    name: "Caveat Brush",
    weights: [400],
    category: "handwriting",
  },
  {
    id: "gochi",
    family: "'Gochi Hand'",
    name: "Gochi Hand",
    weights: [400],
    category: "handwriting",
  },
  {
    id: "patrick",
    family: "'Patrick Hand'",
    name: "Patrick Hand",
    weights: [400],
    category: "handwriting",
  },
];

export function builtinFontById(id: string): FontDef | undefined {
  return BUILTIN_FONTS.find((font) => font.id === id);
}

/* ── Assets ─────────────────────────────────────────────────────────────── */

export type AssetType = "image" | "sticker" | "font";
export type AssetProvider = "bundled" | "local" | "cloudinary";

export interface AssetRecord {
  id: string;
  type: AssetType;
  provider: AssetProvider;
  /** remote url (bundled/cloudinary) — local assets resolve from IndexedDB */
  url?: string;
  /** IndexedDB key for local blobs */
  storeKey?: string;
  name: string;
  width: number;
  height: number;
  /** for fonts */
  family?: string;
  format?: string;
}

export interface LibraryManifestItem {
  id: string;
  type: "image" | "sticker";
  /** origin-root-relative path (basePath is applied at runtime) */
  path: string;
  name: string;
  width: number;
  height: number;
  tags?: string[];
}

export interface LibraryManifest {
  version: 1;
  stickers: LibraryManifestItem[];
  photos: LibraryManifestItem[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function newLayerId(): string {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newAssetId(): string {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isImageLike(layer: Layer): layer is ImageLikeLayer {
  return layer.type === "image" || layer.type === "sticker";
}

export function layerBounds(layer: Layer): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const halfW = layer.width / 2;
  const halfH = layer.height / 2;
  return {
    left: layer.x - halfW,
    top: layer.y - halfH,
    right: layer.x + halfW,
    bottom: layer.y + halfH,
  };
}

/** Clamp a value to the given range. */
export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Snap rotation to the closest multiple of `step` when within `tolerance`. */
export function snapRotation(deg: number, step = 15, tolerance = 4) {
  const snapped = Math.round(deg / step) * step;
  return Math.abs(deg - snapped) <= tolerance ? snapped : deg;
}

export function safeColor(value: string, fallback = "#000000"): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
