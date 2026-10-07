/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   THE single coordinate + transform math module.

   One conversion path only:

     DOCUMENT (design units)
       ⇅  CanvasDims / % / cqh rendering        (SmartEditCanvas)
       ⇅  canvasScreenRect / screenToDesign     (this file — live rect read)
     WORKSPACE / SCREEN (px)
       ⇅  SelectionOverlay geometry            (measured canvas-in-workspace)

   Every consumer — layer rendering, selection bounding boxes, resize /
   rotate handles, pointer hit-testing, drag / resize / rotate calculations —
   derives its geometry from the same canvas rect, so the overlay can never
   drift from the rendered layers when the responsive canvas scales or moves.
─────────────────────────────────────────────────────────────────────────── */

import {
  type Layer,
  type TextLayer,
  clamp,
  snapRotation,
} from "./types";

export type DragMode = "move" | "rotate" | "resize-corner" | "resize-width";

export interface DragState {
  mode: DragMode;
  layerId: string;
  startPointer: { x: number; y: number };
  startLayer: Layer;
  startAngle: number;
  startDistance: number;
}

/** Live screen rect of the canvas surface (viewport px). */
export function canvasScreenRect(el: HTMLElement): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const rect = el.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/**
 * SCREEN/TOUCH → DOCUMENT conversion. The one function every pointer
 * interaction goes through (layer drags on the canvas, handle drags on the
 * selection overlay) — a single scale/offset assumption for hit-testing,
 * dragging, resizing and rotating.
 */
export function screenToDesign(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
  designWidth: number,
): { x: number; y: number } {
  const rect = canvasEl.getBoundingClientRect();
  const scale = rect.width / designWidth || 1;
  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  };
}

/** DOCUMENT → WORKSPACE px frame of a layer (center + size), for the overlay. */
export function layerFrameScreen(
  layer: Layer,
  geom: { left: number; top: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
): { cx: number; cy: number; w: number; h: number } {
  return {
    cx: geom.left + (layer.x / canvasWidth) * geom.width,
    cy: geom.top + (layer.y / canvasHeight) * geom.height,
    w: (layer.width / canvasWidth) * geom.width,
    h: (layer.height / canvasHeight) * geom.height,
  };
}

/** Rotated corner point of a layer frame (screen px, workspace-relative). */
export function frameCorner(
  frame: { cx: number; cy: number; w: number; h: number },
  rotationDeg: number,
  corner: "nw" | "ne" | "sw" | "se" | "w" | "e" | "rotate",
): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Local offsets from the frame centre (CSS rotation: y grows downwards).
  const local: Record<typeof corner, { x: number; y: number }> = {
    nw: { x: -frame.w / 2, y: -frame.h / 2 },
    ne: { x: frame.w / 2, y: -frame.h / 2 },
    sw: { x: -frame.w / 2, y: frame.h / 2 },
    se: { x: frame.w / 2, y: frame.h / 2 },
    w: { x: -frame.w / 2, y: 0 },
    e: { x: frame.w / 2, y: 0 },
    rotate: { x: 0, y: -frame.h / 2 },
  };
  const { x, y } = local[corner];
  return {
    x: frame.cx + x * cos - y * sin,
    y: frame.cy + x * sin + y * cos,
  };
}

/** Begin a transform: capture the drag state (call snapshot() separately). */
export function beginTransform(
  mode: DragMode,
  layer: Layer,
  pointer: { x: number; y: number },
): DragState {
  return {
    mode,
    layerId: layer.id,
    startPointer: pointer,
    startLayer: { ...layer },
    startAngle: Math.atan2(pointer.y - layer.y, pointer.x - layer.x),
    startDistance: Math.hypot(pointer.x - layer.x, pointer.y - layer.y),
  };
}

/**
 * Apply a transform: returns the layer patch for the current pointer
 * position (design units), or null when the mode has no math.
 * Pure — the caller decides how to commit (updateLayerLive during drags).
 */
export function applyTransform(
  drag: DragState,
  pointer: { x: number; y: number },
  designCanvasWidth: number,
): Partial<Layer> | null {
  const start = drag.startLayer;

  if (drag.mode === "move") {
    return {
      x: start.x + (pointer.x - drag.startPointer.x),
      y: start.y + (pointer.y - drag.startPointer.y),
    };
  }

  if (drag.mode === "rotate") {
    const angle = Math.atan2(pointer.y - start.y, pointer.x - start.x);
    let deg = start.rotation + ((angle - drag.startAngle) * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    return { rotation: snapRotation(deg) };
  }

  if (drag.mode === "resize-corner") {
    const ratio =
      drag.startDistance > 4
        ? Math.hypot(pointer.x - start.x, pointer.y - start.y) / drag.startDistance
        : 1;
    if (start.type === "text") {
      return {
        fontSize: clamp(Math.round(start.fontSize * ratio), 8, 720),
        width: clamp(Math.round(start.width * ratio), 60, designCanvasWidth * 2),
      } as Partial<TextLayer>;
    }
    return {
      width: Math.max(24, Math.round(start.width * ratio)),
      height: Math.max(24, Math.round(start.height * ratio)),
    };
  }

  if (drag.mode === "resize-width" && start.type === "text") {
    const rad = (start.rotation * Math.PI) / 180;
    const dx = pointer.x - start.x;
    const dy = pointer.y - start.y;
    const projection = dx * Math.cos(rad) + dy * Math.sin(rad);
    return {
      width: clamp(Math.round(Math.abs(projection) * 2), 60, designCanvasWidth * 2),
    } as Partial<TextLayer>;
  }

  return null;
}

/** True when the layer did not actually change during the drag (no history entry). */
export function transformUnchanged(start: Layer, current: Layer | undefined): boolean {
  if (!current) return true;
  return (
    current.x === start.x &&
    current.y === start.y &&
    current.width === start.width &&
    current.height === start.height &&
    current.rotation === start.rotation &&
    (current.type !== "text" ||
      start.type !== "text" ||
      current.fontSize === start.fontSize)
  );
}
