"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Workspace-level selection + transform overlay.

   The editor workspace (the region between the fixed header and the fixed
   bottom dock) owns this overlay. It is clipped to the workspace
   (overflow:clip — a non-scrolling clip), so selection UI can NEVER visually
   or interactively escape into the application chrome — no matter how large
   or close to an edge the selected layer is.

   Geometry: the canvas position inside the overlay is measured with
   ResizeObservers (never per pointer event). Handles are plain screen px —
   constant touch size by construction — and every drag goes through
   transform.ts' screenToDesign against the canvas element, i.e. the exact
   same conversion the on-canvas layer drags use.

   Large layers: the bounding box tracks the object's true frame (which may
   extend past the workspace and become clipped), while the handles CLAMP
   into the usable workspace region — controls stay reachable without
   altering the object's document coordinates.
─────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { type Layer } from "./types";
import { useEditorStore } from "./store";
import {
  type DragMode,
  type DragState,
  applyTransform,
  beginTransform,
  frameCorner,
  layerFrameScreen,
  screenToDesign,
  transformUnchanged,
} from "./transform";

/* Handle metrics — screen px, sized for fingers (constant on every device). */
const HANDLE_VISUAL = 14;
const HANDLE_HIT = 34;
/** Handles clamp at least this far inside the overlay (fully visible hit areas). */
const EDGE_MARGIN = 22;
/** Extra top clearance below the floating selection action bar. */
const BAR_MARGIN = 62;
/** Rotate handle offset above the frame's top edge. */
const ROTATE_OFFSET = 30;

interface CanvasGeom {
  left: number;
  top: number;
  width: number;
  height: number;
  boxW: number;
  boxH: number;
}

export interface SelectionOverlayProps {
  canvasRef: RefObject<HTMLDivElement | null>;
}

export function SelectionOverlay({ canvasRef }: SelectionOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  const doc = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const editingId = useEditorStore((s) => s.editingId);

  /* ── Canvas geometry inside the overlay (ResizeObserver-driven) ───────── */

  const [geom, setGeom] = useState<CanvasGeom | null>(null);

  useLayoutEffect(() => {
    const canvasEl = canvasRef.current;
    const rootEl = rootRef.current;
    if (!canvasEl || !rootEl) return;
    let raf = 0;
    let last: CanvasGeom | null = null;
    const measure = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const c = canvasEl.getBoundingClientRect();
        const b = rootEl.getBoundingClientRect();
        if (c.width === 0 || b.width === 0) return;
        const next: CanvasGeom = {
          left: c.left - b.left,
          top: c.top - b.top,
          width: c.width,
          height: c.height,
          boxW: b.width,
          boxH: b.height,
        };
        if (
          last &&
          Math.abs(last.left - next.left) < 0.5 &&
          Math.abs(last.top - next.top) < 0.5 &&
          Math.abs(last.width - next.width) < 0.5 &&
          Math.abs(last.height - next.height) < 0.5
        ) {
          return;
        }
        last = next;
        setGeom(next);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvasEl);
    observer.observe(rootEl);
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [canvasRef]);

  /* ── Handle drags — same transform math as on-canvas layer drags ─────── */

  const beginHandleDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, mode: DragMode, layer: Layer) => {
      event.stopPropagation();
      if (layer.locked) return;
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // best-effort capture (stale pointer ids throw)
      }
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const pointer = screenToDesign(
        event.clientX,
        event.clientY,
        canvasEl,
        doc.canvas.width,
      );
      dragRef.current = beginTransform(mode, layer, pointer);
      useEditorStore.getState().snapshot();
    },
    [canvasRef, doc.canvas.width],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      event.preventDefault();
      pendingRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          const pending = pendingRef.current;
          const drag = dragRef.current;
          if (!pending || !drag) return;
          pendingRef.current = null;
          const canvasEl = canvasRef.current;
          if (!canvasEl) return;
          const pointer = screenToDesign(
            pending.clientX,
            pending.clientY,
            canvasEl,
            doc.canvas.width,
          );
          const patch = applyTransform(drag, pointer, doc.canvas.width);
          if (patch) useEditorStore.getState().updateLayerLive(drag.layerId, patch);
        });
      }
    },
    [canvasRef, doc.canvas.width],
  );

  const endHandleDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      dragRef.current = null;
      pendingRef.current = null;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // pointer already released
      }
      const state = useEditorStore.getState();
      const current = state.document.layers.find((l) => l.id === drag.layerId);
      if (transformUnchanged(drag.startLayer, current)) state.dropLastSnapshot();
    },
    [],
  );

  /* ── Render ───────────────────────────────────────────────────────────── */

  const selected = doc.layers.find((l) => l.id === selection) ?? null;
  const visible = selected && !editingId && selected.visible;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-10 overflow-clip"
      onPointerMove={onPointerMove}
      onPointerUp={endHandleDrag}
      onPointerCancel={endHandleDrag}
      aria-hidden={!visible}
    >
      {visible && geom && (
        <SelectionFrame
          layer={selected}
          geom={geom}
          canvasWidth={doc.canvas.width}
          canvasHeight={doc.canvas.height}
          onBeginDrag={beginHandleDrag}
        />
      )}
    </div>
  );
}

/* ── Selection frame + clamped handles ──────────────────────────────────── */

function SelectionFrame({
  layer,
  geom,
  canvasWidth,
  canvasHeight,
  onBeginDrag,
}: {
  layer: Layer;
  geom: CanvasGeom;
  canvasWidth: number;
  canvasHeight: number;
  onBeginDrag: (
    event: ReactPointerEvent<HTMLDivElement>,
    mode: DragMode,
    layer: Layer,
  ) => void;
}) {
  // The floating action bar sits at the top of the workspace whenever a
  // layer is selected — handles must clear it.
  const bounds = {
    minX: EDGE_MARGIN,
    maxX: geom.boxW - EDGE_MARGIN,
    minY: BAR_MARGIN,
    maxY: geom.boxH - EDGE_MARGIN,
  };

  const f = layerFrameScreen(layer, geom, canvasWidth, canvasHeight);

  const rot = layer.rotation;
  const nw = frameCorner(f, rot, "nw");
  const ne = frameCorner(f, rot, "ne");
  const sw = frameCorner(f, rot, "sw");
  const se = frameCorner(f, rot, "se");
  const rotateAnchor = frameCorner(f, rot, "rotate");
  const rad = (rot * Math.PI) / 180;
  const rotatePos = {
    x: rotateAnchor.x + Math.sin(rad) * ROTATE_OFFSET,
    y: rotateAnchor.y - Math.cos(rad) * ROTATE_OFFSET,
  };

  const clampX = (x: number) => Math.min(Math.max(x, bounds.minX), bounds.maxX);
  const clampY = (y: number) => Math.min(Math.max(y, bounds.minY), bounds.maxY);

  const nwC = { x: clampX(nw.x), y: clampY(nw.y) };
  const neC = { x: clampX(ne.x), y: clampY(ne.y) };
  const swC = { x: clampX(sw.x), y: clampY(sw.y) };
  const seC = { x: clampX(se.x), y: clampY(se.y) };
  const rotC = { x: clampX(rotatePos.x), y: clampY(rotatePos.y) };

  return (
    <>
      {/* true bounding box — may be clipped by the overlay when the layer
          extends past the workspace, but always tracks the object exactly */}
      <div
        style={{
          position: "absolute",
          left: f.cx - f.w / 2,
          top: f.cy - f.h / 2,
          width: f.w,
          height: f.h,
          transform: `rotate(${rot}deg)`,
          borderRadius: 2,
          outline: "1.5px solid #fff",
          boxShadow: "0 0 0 1px rgba(10,10,10,0.35)",
        }}
      />

      {/* rotate stem — from the frame's top edge to the (clamped) handle */}
      <svg
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1={rotateAnchor.x}
          y1={rotateAnchor.y}
          x2={rotC.x}
          y2={rotC.y}
          stroke="#fff"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>

      {/* corner resize handles (clamped into the usable workspace) */}
      <Handle pos={nwC} cursor="nwse-resize" label="Resize" onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)} />
      <Handle pos={neC} cursor="nesw-resize" label="Resize" onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)} />
      <Handle pos={swC} cursor="nesw-resize" label="Resize" onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)} />
      <Handle pos={seC} cursor="nwse-resize" label="Resize" onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)} />

      {/* text width handles */}
      {layer.type === "text" && (
        <>
          <Handle
            pos={{ x: clampX(frameCorner(f, rot, "w").x), y: clampY(frameCorner(f, rot, "w").y) }}
            cursor="ew-resize"
            label="Change text width"
            pill
            onPointerDown={(e) => onBeginDrag(e, "resize-width", layer)}
          />
          <Handle
            pos={{ x: clampX(frameCorner(f, rot, "e").x), y: clampY(frameCorner(f, rot, "e").y) }}
            cursor="ew-resize"
            label="Change text width"
            pill
            onPointerDown={(e) => onBeginDrag(e, "resize-width", layer)}
          />
        </>
      )}

      {/* rotate handle */}
      <Handle
        pos={rotC}
        cursor="grab"
        label="Rotate"
        dark
        onPointerDown={(e) => onBeginDrag(e, "rotate", layer)}
      />
    </>
  );
}

/* ── Handle ─────────────────────────────────────────────────────────────── */

function Handle({
  pos,
  cursor,
  label,
  pill,
  dark,
  onPointerDown,
}: {
  pos: { x: number; y: number };
  cursor: string;
  label: string;
  pill?: boolean;
  dark?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const visual: CSSProperties = {
    width: HANDLE_VISUAL,
    height: HANDLE_VISUAL,
    borderRadius: pill ? 4 : 999,
    background: dark ? "#0a0a0a" : "#fff",
    border: dark ? "1.5px solid #fff" : "1.5px solid rgba(10,10,10,0.85)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    cursor,
  };
  return (
    <div
      role="button"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: HANDLE_HIT,
        height: HANDLE_HIT,
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        pointerEvents: "auto",
        cursor,
      }}
    >
      <div style={visual} />
    </div>
  );
}
