/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Pure crop geometry. Every crop computation in the app — the on-canvas
   renderer (SmartEditCanvas), the crop editor (cropEditor.tsx) and the
   Canvas2D export renderer (exportRenderer.ts) — derives its numbers from
   THIS module, so the cropped composition is identical in the editor, the
   My Projects preview, the PNG/JPG export and the public viewer.

   Coordinate model (deterministic composition order):

     DOCUMENT (design units)
       ⇅ layer transform — x, y, width, height, rotation, opacity (UNCHANGED
         by cropping; the frame simply takes the crop's aspect ratio)
     LAYER FRAME (design units, the crop viewport on the canvas)
       ⇅ frame ← crop mapping below
     ROTATED IMAGE SPACE (px, the original image rotated `crop.rotation`
       around its centre; bounding box W'×H'; for 90° steps the rotated
       content fills it exactly)
       ⇎ crop rect {x, y, width, height} normalised over W'×H'
     IMAGE CONTENT (original W×H px)

   Because the crop rect is normalised, it survives asset re-encoding,
   device pixel ratio changes and any rendering size. Nothing here touches
   the DOM, React state or the store — pure functions only.
─────────────────────────────────────────────────────────────────────────── */

import type { CropState, ImageLayer } from "./types";

/** Tolerance for "numerically full / equal" crop comparisons. */
export const CROP_EPS = 1e-4;

/* ── Rotated space ─────────────────────────────────────────────────────── */

/**
 * Dimensions of the rotated image space: the bounding box of the original
 * W×H image after `rotationDeg` clockwise. For multiples of 90° this is the
 * exact rotated image (axes swap); otherwise it is the axis-aligned
 * bounding box (the crop UI only produces 90° steps, but the math is
 * general so a fine-rotation extension needs no model change).
 */
export function rotatedImageDims(
  natural: { width: number; height: number },
  rotationDeg: number,
): { width: number; height: number } {
  const w = Math.max(1, natural.width);
  const h = Math.max(1, natural.height);
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  // Snap axis-aligned cases to exact values (no float drift at 90° steps).
  const isAxis = Math.min(c, s) < 1e-6;
  if (isAxis) {
    const swap = s > c; // 90° / 270°
    return swap ? { width: h, height: w } : { width: w, height: h };
  }
  return { width: w * c + h * s, height: w * s + h * c };
}

/** Crop rect in rotated-space pixels. */
export function cropRectPx(
  crop: CropState,
  natural: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const dims = rotatedImageDims(natural, crop.rotation);
  return {
    x: crop.x * dims.width,
    y: crop.y * dims.height,
    width: Math.max(1, crop.width * dims.width),
    height: Math.max(1, crop.height * dims.height),
  };
}

/** Aspect ratio (width / height) of the cropped content, in px terms. */
export function cropAspect(
  crop: CropState,
  natural: { width: number; height: number },
): number {
  const r = cropRectPx(crop, natural);
  return r.width / r.height;
}

/** A crop that shows the whole image at the given rotation. */
export function fullCrop(rotation = 0): CropState {
  return { x: 0, y: 0, width: 1, height: 1, rotation };
}

/** True when the crop shows the entire unrotated image (= "no crop"). */
export function isNoCrop(crop: CropState | undefined): boolean {
  if (!crop) return true;
  return (
    Math.abs(((crop.rotation % 360) + 360) % 360) < CROP_EPS &&
    crop.x <= CROP_EPS &&
    crop.y <= CROP_EPS &&
    crop.width >= 1 - CROP_EPS &&
    crop.height >= 1 - CROP_EPS
  );
}

/** True when two crops describe the same visible composition. */
export function sameCrop(a: CropState | undefined, b: CropState | undefined): boolean {
  if (isNoCrop(a) && isNoCrop(b)) return true;
  if (!a || !b) return false;
  const diff = Math.abs(a.rotation - b.rotation) % 360;
  const rotSame = diff <= CROP_EPS || 360 - diff <= CROP_EPS;
  return (
    rotSame &&
    Math.abs(a.x - b.x) <= CROP_EPS &&
    Math.abs(a.y - b.y) <= CROP_EPS &&
    Math.abs(a.width - b.width) <= CROP_EPS &&
    Math.abs(a.height - b.height) <= CROP_EPS
  );
}

/* ── DOM rendering (SmartEditCanvas LayerView) ─────────────────────────── */

export interface CropImageStyle {
  /** position of the unrotated image box, % of the frame */
  left: number;
  top: number;
  width: number;
  height: number;
  /** content rotation, degrees clockwise */
  rotate: number;
}

/**
 * Frame-relative CSS geometry for the <img> inside a cropped image layer.
 *
 * The image is drawn as its natural W×H box, scaled so the crop rect maps
 * exactly onto the frame, then rotated `crop.rotation` around its own
 * centre (transform-origin: center). All values are percentages of the
 * frame, so the result is resolution-independent and identical at any
 * canvas size — the same contract the rest of SmartEditCanvas uses.
 *
 * Uncropped check: crop {0,0,1,1,0} → left 0, top 0, width 100, height 100,
 * rotate 0 — i.e. exactly the previous non-crop rendering.
 */
export function cropImageStyle(
  crop: CropState,
  natural: { width: number; height: number },
): CropImageStyle {
  const W = Math.max(1, natural.width);
  const H = Math.max(1, natural.height);
  const dims = rotatedImageDims(natural, crop.rotation);
  const RW = dims.width;
  const RH = dims.height;
  const rect = cropRectPx(crop, natural);
  // Frame units per rotated-space px. If the layer frame's aspect ever
  // drifts from the crop aspect (only possible via crafted payloads), the
  // mapping stretches exactly like the uncropped object-fit:fill behaviour.
  const sx = 1 / rect.width; // frame fraction per rotated px, x axis
  const sy = 1 / rect.height;
  // Crop rect centre in rotated space.
  const cRx = rect.x + rect.width / 2;
  const cRy = rect.y + rect.height / 2;
  // Rotated-space origin (= image centre) lands at this frame fraction.
  const originX = 0.5 + (0.5 * RW - cRx) * sx;
  const originY = 0.5 + (0.5 * RH - cRy) * sy;
  // The unrotated image box: CSS `rotate(θ)` conjugates the frame scales —
  // for 90°/270° the image's width axis lies along the frame's y axis, so
  // the box takes the SWAPPED scales (boxW = W·sy, boxH = H·sx). When the
  // frame aspect matches the crop aspect (always true for editor-created
  // crops) sx === sy and this is a uniform scale for any θ.
  const rad = (crop.rotation * Math.PI) / 180;
  const swap = Math.abs(Math.sin(rad)) > Math.abs(Math.cos(rad));
  const boxW = swap ? W * sy : W * sx;
  const boxH = swap ? H * sx : H * sy;
  return {
    left: (originX - boxW / 2) * 100,
    top: (originY - boxH / 2) * 100,
    width: boxW * 100,
    height: boxH * 100,
    rotate: crop.rotation,
  };
}

/* ── Canvas2D rendering (exportRenderer) ───────────────────────────────── */

export interface CropCanvasTransform {
  /** translate applied in FRAME units before scale/rotate */
  tx: number;
  ty: number;
  /** uniform-ish scale: frame units per rotated px */
  sx: number;
  sy: number;
  /** content rotation in radians */
  rotationRad: number;
}

/**
 * Canvas transform values for drawing the ORIGINAL image so the crop rect
 * maps onto the layer frame. Call sequence (after translating the context
 * to the layer centre + applying the outer layer rotation and clipping to
 * the frame):
 *
 *   ctx.translate(tx, ty); ctx.scale(sx, sy); ctx.rotate(rotationRad);
 *   ctx.drawImage(img, -W/2, -H/2, W, H);
 *
 * Composition: image point p → frame position Diag(s)·Rot(θ)·p + (tx, ty).
 */
export function cropCanvasTransform(
  crop: CropState,
  natural: { width: number; height: number },
  frameWidth: number,
  frameHeight: number,
): CropCanvasTransform {
  const rect = cropRectPx(crop, natural);
  const dims = rotatedImageDims(natural, crop.rotation);
  const sx = frameWidth / rect.width;
  const sy = frameHeight / rect.height;
  const cRx = rect.x + rect.width / 2;
  const cRy = rect.y + rect.height / 2;
  // The ctx is already translated to the frame CENTRE, so the translate
  // places the rotated-space origin (= image centre) at its frame position:
  // frame pos of R-origin = Diag(s)·((RW/2, RH/2) − cropCentre).
  return {
    tx: (dims.width / 2 - cRx) * sx,
    ty: (dims.height / 2 - cRy) * sy,
    sx,
    sy,
    rotationRad: (crop.rotation * Math.PI) / 180,
  };
}

/* ── Committing a crop to the layer ────────────────────────────────────── */

/**
 * Layer patch for "apply this crop to the layer": the frame keeps its
 * centre / rotation / opacity and preserves its AREA while taking the
 * crop's aspect ratio (no sudden size jumps, and the content is never
 * distorted — the frame always matches the visible content's aspect).
 */
export function cropLayerPatch(
  layer: ImageLayer,
  crop: CropState | undefined,
): Partial<ImageLayer> {
  if (!crop || isNoCrop(crop)) {
    // Reset to the uncropped image: frame takes the natural aspect.
    const aspect = Math.max(1, layer.natural.width) / Math.max(1, layer.natural.height);
    const area = Math.max(24 * 24, layer.width * layer.height);
    return {
      crop: undefined,
      width: round2(Math.max(24, Math.sqrt(area * aspect))),
      height: round2(Math.max(24, Math.sqrt(area / aspect))),
    };
  }
  const aspect = cropAspect(crop, layer.natural);
  const area = Math.max(24 * 24, layer.width * layer.height);
  return {
    crop,
    width: round2(Math.max(24, Math.sqrt(area * aspect))),
    height: round2(Math.max(24, Math.sqrt(area / aspect))),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ── Crop editor session geometry ──────────────────────────────────────── */

/**
 * The crop editor's live state. The crop rect is NOT stored during the
 * session — it is derived on Done. The session describes how the image is
 * presented under the crop viewport:
 *
 *   zoom    screen px per rotated-space px
 *   offset  image centre relative to the viewport centre, screen px
 *   vp      the crop viewport rect, workspace px
 *
 * Every gesture (handle drag, image pan, pinch, wheel, ratio, rotate)
 * mutates these values through clampCropSession(), which enforces the
 * IMAGE COVERAGE RULE: the image content always fully covers the viewport.
 */
export interface CropSession {
  rotation: number;
  zoom: number;
  offset: { x: number; y: number };
  vp: { x: number; y: number; w: number; h: number };
}

/** Minimum viewport size on screen (handles stay usable). */
export const CROP_MIN_VIEWPORT_PX = 64;
/** Minimum crop size in image pixels (never crop to a sliver). */
export const CROP_MIN_IMAGE_PX = 32;
/** Viewport keeps this margin inside the workspace. */
export const CROP_WORKSPACE_MARGIN = 14;

/** Largest rect with `aspect` that fits inside `box`, centred. */
export function fitRectAspect(
  box: { width: number; height: number },
  aspect: number,
): { width: number; height: number } {
  let width = box.width;
  let height = width / aspect;
  if (height > box.height) {
    height = box.height;
    width = height * aspect;
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

/**
 * Coverage clamps — the single place the "image must always cover the crop
 * viewport" rule is enforced. Mutates and returns a new session object.
 */
export function clampCropSession(
  session: CropSession,
  rotated: { width: number; height: number },
  workspace: { width: number; height: number },
): CropSession {
  const vp = { ...session.vp };
  const RW = Math.max(1, rotated.width);
  const RH = Math.max(1, rotated.height);

  // Viewport must respect the workspace bounds and a minimum size.
  vp.w = Math.min(Math.max(vp.w, CROP_MIN_VIEWPORT_PX), Math.max(CROP_MIN_VIEWPORT_PX, workspace.width - 2 * CROP_WORKSPACE_MARGIN));
  vp.h = Math.min(Math.max(vp.h, CROP_MIN_VIEWPORT_PX), Math.max(CROP_MIN_VIEWPORT_PX, workspace.height - 2 * CROP_WORKSPACE_MARGIN));
  vp.x = Math.min(Math.max(vp.x, CROP_WORKSPACE_MARGIN), Math.max(CROP_WORKSPACE_MARGIN, workspace.width - CROP_WORKSPACE_MARGIN - vp.w));
  vp.y = Math.min(Math.max(vp.y, CROP_WORKSPACE_MARGIN), Math.max(CROP_WORKSPACE_MARGIN, workspace.height - CROP_WORKSPACE_MARGIN - vp.h));

  // Zoom: large enough that the image covers the viewport, small enough
  // that the crop never shrinks below CROP_MIN_IMAGE_PX image pixels.
  const zoomFloor = Math.max(vp.w / RW, vp.h / RH);
  const zoomCeil = Math.max(zoomFloor, Math.min(vp.w, vp.h) / CROP_MIN_IMAGE_PX);
  const zoom = Math.min(Math.max(session.zoom, zoomFloor), zoomCeil);

  // Offset: the image (centred at viewport centre + offset, extents RW·zoom
  // × RH·zoom) must cover the viewport rect on both axes.
  const maxX = Math.max(0, (RW * zoom - vp.w) / 2);
  const maxY = Math.max(0, (RH * zoom - vp.h) / 2);
  const offset = {
    x: Math.min(Math.max(session.offset.x, -maxX), maxX),
    y: Math.min(Math.max(session.offset.y, -maxY), maxY),
  };

  return { rotation: session.rotation, zoom, offset, vp };
}

/**
 * Derive the persisted CropState from a (clamped) session. The viewport
 * centre maps to the crop rect centre; the viewport size maps to the crop
 * size — everything else (frame style, export) derives from the crop.
 */
export function cropFromSession(
  session: CropSession,
  rotated: { width: number; height: number },
): CropState {
  const RW = Math.max(1, rotated.width);
  const RH = Math.max(1, rotated.height);
  const cropW = session.vp.w / session.zoom;
  const cropH = session.vp.h / session.zoom;
  const cRx = RW / 2 - session.offset.x / session.zoom;
  const cRy = RH / 2 - session.offset.y / session.zoom;
  const crop: CropState = {
    x: clamp01((cRx - cropW / 2) / RW),
    y: clamp01((cRy - cropH / 2) / RH),
    width: clamp01(cropW / RW),
    height: clamp01(cropH / RH),
    rotation: (((session.rotation % 360) + 360) % 360),
  };
  return crop;
}

/**
 * Inverse of cropFromSession: build the session that presents an existing
 * crop, with the viewport fitted comfortably inside the workspace.
 */
export function sessionFromCrop(
  crop: CropState | undefined,
  natural: { width: number; height: number },
  workspace: { width: number; height: number },
  fitScale = 0.86,
): CropSession {
  const effective = crop ?? fullCrop(0);
  const rotated = rotatedImageDims(natural, effective.rotation);
  const rect = cropRectPx(effective, natural);
  // Viewport: the crop rect at a scale that fits the workspace.
  const room = {
    width: Math.max(CROP_MIN_VIEWPORT_PX + 2 * CROP_WORKSPACE_MARGIN, workspace.width * fitScale),
    height: Math.max(CROP_MIN_VIEWPORT_PX + 2 * CROP_WORKSPACE_MARGIN, workspace.height * fitScale),
  };
  const fit = fitRectAspect(room, rect.width / rect.height);
  const zoom = Math.min(fit.width / rect.width, fit.height / rect.height);
  const vp = {
    x: (workspace.width - fit.width) / 2,
    y: (workspace.height - fit.height) / 2,
    w: rect.width * zoom,
    h: rect.height * zoom,
  };
  // Image centre: the crop rect centre sits at the viewport centre.
  const cRx = rect.x + rect.width / 2;
  const cRy = rect.y + rect.height / 2;
  const offset = {
    x: (rotated.width / 2 - cRx) * zoom,
    y: (rotated.height / 2 - cRy) * zoom,
  };
  return clampCropSession({ rotation: effective.rotation, zoom, offset, vp }, rotated, workspace);
}

/* ── Aspect-ratio presets ──────────────────────────────────────────────── */

export type CropPresetId = "original" | "free" | "1:1" | "4:5" | "3:4" | "3:2" | "16:9" | "9:16";

export interface CropPreset {
  id: CropPresetId;
  label: string;
  /** null for Original (image aspect) and Free (unlocked) */
  ratio: number | null;
}

export const CROP_PRESETS: CropPreset[] = [
  { id: "original", label: "Original", ratio: null },
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

export function cropPresetById(id: CropPresetId): CropPreset {
  return CROP_PRESETS.find((p) => p.id === id) ?? CROP_PRESETS[1];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
