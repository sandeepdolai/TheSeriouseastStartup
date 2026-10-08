"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   The canvas renderer. One component draws a SmartEditDocument at ANY size:
   the wrapper carries the canvas aspect ratio + container-type:size, layers
   position themselves with % units and size text with cqh units, so the exact
   same markup serves the editor, My Projects previews and the public viewer.

   interactive=true connects the component to the editor store (selection,
   move / text editing). Resizing + rotating live on the workspace-level
   SelectionOverlay (selectionOverlay.tsx) which shares the transform math in
   transform.ts; layer *movement* drags start here on the layers themselves.

   The wrapper always clips to the document bounds (overflow:hidden) — the
   editor therefore shows exactly what the public viewer and the PNG/JPG
   export render. Layers may still extend beyond the canvas in document
   coordinates; their visible portion remains interactive.
─────────────────────────────────────────────────────────────────────────── */

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  type Layer,
  type SmartEditDocument,
  type TextLayer,
  isImageLike,
} from "./types";
import { layoutTextLayer, onFontsChanged } from "./textLayout";
import { assetUrl, onAssetsChanged } from "./assets";
import { cropImageStyle } from "./crop";
import { useEditorStore } from "./store";
import {
  type DragMode,
  type DragState,
  applyTransform,
  beginTransform,
  screenToDesign,
  transformUnchanged,
} from "./transform";

/* ── Canvas design dims via context (for % / cqh math) ──────────────────── */

const CanvasDims = createContext<{ width: number; height: number }>({
  width: 1080,
  height: 1350,
});

const pctX = (value: number, canvasWidth: number) => `${(value / canvasWidth) * 100}%`;
const pctY = (value: number, canvasHeight: number) => `${(value / canvasHeight) * 100}%`;
/** design-unit font size → container query height units */
const cqh = (value: number, canvasHeight: number) => `${(value / canvasHeight) * 100}cqh`;

/* ── Runtime tick: re-render once real fonts / asset urls arrive ────────── */

function useRuntimeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const offFonts = onFontsChanged(bump);
    const offAssets = onAssetsChanged(bump);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) bump();
    });
    return () => {
      alive = false;
      offFonts();
      offAssets();
    };
  }, []);
  return tick;
}

/* ── Layer view ─────────────────────────────────────────────────────────── */

interface LayerViewProps {
  layer: Layer;
  zIndex: number;
  interactive: boolean;
  /** resolved url for image-like layers (editor resolves via registry) */
  resolvedUrl?: string;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
}

const LayerView = memo(function LayerView({
  layer,
  zIndex,
  interactive,
  resolvedUrl,
  onPointerDown,
  onDoubleClick,
}: LayerViewProps) {
  useRuntimeTick();
  const { width: cw, height: ch } = useContext(CanvasDims);

  const style: CSSProperties = {
    position: "absolute",
    left: pctX(layer.x, cw),
    top: pctY(layer.y, ch),
    width: pctX(layer.width, cw),
    height: pctY(layer.height, ch),
    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    zIndex,
    pointerEvents: interactive && !layer.locked ? "auto" : "none",
    cursor: interactive && !layer.locked ? "move" : undefined,
  };

  if (layer.type === "text") {
    const lines = layoutTextLayer(layer);
    return (
      <div style={{ ...style, height: "auto" }} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
        {lines.map((line, index) => (
          <div
            key={index}
            style={{
              fontSize: cqh(layer.fontSize, ch),
              lineHeight: layer.lineHeight,
              color: layer.color,
              textAlign: layer.align,
              whiteSpace: "pre",
              fontFamily: layer.fontFamily,
              fontWeight: layer.fontWeight,
            }}
          >
            {line || "\u00A0"}
          </div>
        ))}
      </div>
    );
  }

  // Cropped photos: the <img> is the ORIGINAL (never re-encoded) asset,
  // positioned/scaled so the crop rect maps exactly onto the layer frame
  // and rotated by the crop rotation — pure percentages of the frame, so
  // the identical markup renders in the editor, My Projects previews, the
  // export and the public viewer. cropImageStyle({0,0,1,1,0}) reduces to
  // the plain 100%×100% fill, so uncropped layers keep the exact previous
  // rendering path.
  const crop = layer.type === "image" ? layer.crop : undefined;

  return (
    <div
      style={{ ...style, ...(crop ? { overflow: "clip" } : null) }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {resolvedUrl ? (
        crop ? (
          (() => {
            const geo = cropImageStyle(crop, layer.natural);
            return (
              <img
                src={resolvedUrl}
                alt={layer.type === "sticker" ? "Sticker" : "Image"}
                draggable={false}
                style={{
                  position: "absolute",
                  left: `${geo.left}%`,
                  top: `${geo.top}%`,
                  width: `${geo.width}%`,
                  height: `${geo.height}%`,
                  // Tailwind's preflight clamps imgs to max-width:100% —
                  // a zoomed crop draws the photo LARGER than the frame.
                  maxWidth: "none",
                  maxHeight: "none",
                  transform: `rotate(${geo.rotate}deg)`,
                  objectFit: "fill",
                  display: "block",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              />
            );
          })()
        ) : (
          <img
            src={resolvedUrl}
            alt={layer.type === "sticker" ? "Sticker" : "Image"}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }}
          />
        )
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "1.2cqh",
            background:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 8%, rgba(0,0,0,0.03) 8% 16%)",
          }}
        />
      )}
    </div>
  );
});

/* ── Editor interactions ────────────────────────────────────────────────── */

interface DragStateRefs {
  drag: DragState | null;
  pending: { clientX: number; clientY: number } | null;
  frame: number | null;
}

export interface SmartEditCanvasProps {
  document: SmartEditDocument;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  /**
   * External handle to the canvas surface element. The editor shell passes
   * one so the workspace SelectionOverlay measures + converts pointer
   * coordinates against the exact same element this component renders into.
   */
  surfaceRef?: RefObject<HTMLDivElement | null>;
}

export function SmartEditCanvas({
  document: staticDocument,
  interactive = false,
  className,
  style,
  surfaceRef,
}: SmartEditCanvasProps) {
  const localWrapperRef = useRef<HTMLDivElement>(null);
  const wrapperRef = surfaceRef ?? localWrapperRef;
  const refs = useRef<DragStateRefs>({ drag: null, pending: null, frame: null });
  const tapRef = useRef<{ id: string; time: number } | null>(null);

  const storeDocument = useEditorStore((s) => (interactive ? s.document : null));
  const editingId = useEditorStore((s) => (interactive ? s.editingId : null));
  const assetsVersion = useEditorStore((s) => (interactive ? s.assetsVersion : 0));

  const document = interactive ? storeDocument! : staticDocument;
  useRuntimeTick();
  void assetsVersion;

  const store = useEditorStore;

  const toDesignUnits = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapperRef.current;
      if (!el) return { x: 0, y: 0 };
      return screenToDesign(clientX, clientY, el, document.canvas.width);
    },
    [document.canvas.width, wrapperRef],
  );

  const applyDrag = useCallback(() => {
    const pending = refs.current.pending;
    const drag = refs.current.drag;
    if (!pending || !drag) return;
    refs.current.pending = null;
    const pointer = toDesignUnits(pending.clientX, pending.clientY);
    const patch = applyTransform(drag, pointer, document.canvas.width);
    if (patch) store.getState().updateLayerLive(drag.layerId, patch);
  }, [document.canvas.width, store, toDesignUnits]);

  const beginDrag = useCallback(
    (event: ReactPointerEvent<Element>, mode: DragMode, layer: Layer) => {
      event.stopPropagation();
      if (layer.locked || !interactive) return;
      try {
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      } catch {
        // Capture is best-effort (stale pointer ids throw) — events still
        // bubble to the wrapper handlers.
      }
      const pointer = toDesignUnits(event.clientX, event.clientY);
      refs.current.drag = beginTransform(mode, layer, pointer);
      store.getState().snapshot();
    },
    [interactive, store, toDesignUnits],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<Element>) => {
      const drag = refs.current.drag;
      if (!drag) return;
      if (refs.current.frame !== null) {
        cancelAnimationFrame(refs.current.frame);
        refs.current.frame = null;
      }
      refs.current.drag = null;
      refs.current.pending = null;
      try {
        (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
      } catch {
        // pointer already released
      }
      const state = store.getState();
      const current = state.document.layers.find((l) => l.id === drag.layerId);
      if (transformUnchanged(drag.startLayer, current)) state.dropLastSnapshot();
    },
    [store],
  );

  const onLayerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, layer: Layer) => {
      if (!interactive || layer.locked || !layer.visible) return;
      event.stopPropagation();

      const state = store.getState();
      if (state.editingId && state.editingId !== layer.id) state.startEditing(null);

      // Double-tap / double-click enters text edit mode.
      if (layer.type === "text") {
        const now = performance.now();
        const last = tapRef.current;
        const isTouch = event.pointerType === "touch" || event.pointerType === "pen";
        if (isTouch) {
          if (last && last.id === layer.id && now - last.time < 340) {
            tapRef.current = null;
            state.startEditing(layer.id);
            return;
          }
          tapRef.current = { id: layer.id, time: now };
        }
      }
      if (state.editingId === layer.id) return; // typing — keep the caret

      state.select(layer.id);
      beginDrag(event, "move", layer);
    },
    [beginDrag, interactive, store],
  );

  const onLayerDoubleClick = useCallback(
    (layer: Layer) => {
      if (!interactive || layer.type !== "text" || layer.locked) return;
      store.getState().startEditing(layer.id);
    },
    [interactive, store],
  );

  const onWrapperPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      if (event.target !== event.currentTarget) return; // clicks pass through layers
      const state = store.getState();
      if (state.editingId) state.startEditing(null);
      state.select(null);
    },
    [interactive, store],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!refs.current.drag) return;
      event.preventDefault();
      refs.current.pending = { clientX: event.clientX, clientY: event.clientY };
      if (refs.current.frame === null) {
        refs.current.frame = requestAnimationFrame(() => {
          refs.current.frame = null;
          applyDrag();
        });
      }
    },
    [applyDrag],
  );

  const editingLayer = document.layers.find((l) => l.id === editingId && l.type === "text") ?? null;

  return (
    <CanvasDims.Provider value={document.canvas}>
      <div
        ref={wrapperRef}
        className={className}
        style={{
          position: "relative",
          aspectRatio: `${document.canvas.width} / ${document.canvas.height}`,
          containerType: "size",
          background: document.background.type === "color" ? document.background.color : "#fff",
          // `clip` (not `hidden`): clip WITHOUT creating a scroll container —
          // browser focus/scroll-into-view can never shift the rendered
          // layers inside the canvas box (a scrolled overflow:hidden canvas
          // would desynchronise rendering from the selection overlay).
          overflow: "clip",
          touchAction: interactive ? "none" : "auto",
          userSelect: interactive ? "none" : "auto",
          WebkitUserSelect: interactive ? "none" : "auto",
          ...style,
        }}
        onPointerDown={interactive ? onWrapperPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? endDrag : undefined}
        onPointerCancel={interactive ? endDrag : undefined}
        role={interactive ? "application" : undefined}
        aria-label={interactive ? "Smart Edit canvas" : undefined}
      >
        {document.layers.map((layer, index) =>
          layer.visible && editingId !== layer.id ? (
            <LayerView
              key={layer.id}
              layer={layer}
              zIndex={index + 1}
              interactive={interactive}
              resolvedUrl={
                isImageLike(layer)
                  ? layer.url && /^(https?:|data:|blob:)/.test(layer.url)
                    ? layer.url
                    : assetUrl(layer.assetId)
                  : undefined
              }
              onPointerDown={interactive ? (e) => onLayerPointerDown(e, layer) : undefined}
              onDoubleClick={interactive ? () => onLayerDoubleClick(layer) : undefined}
            />
          ) : null,
        )}

        {/* text editing overlay — lives on the canvas so it aligns with the
            text layer through the exact same % / cqh transform. Selection,
            resize and rotate controls live on the workspace SelectionOverlay. */}
        {interactive && editingLayer && (
          <TextEditorOverlay
            layer={editingLayer as TextLayer}
            onDone={() => store.getState().startEditing(null)}
          />
        )}
      </div>
    </CanvasDims.Provider>
  );
}

/* ── Text editing overlay ───────────────────────────────────────────────── */

function TextEditorOverlay({ layer, onDone }: { layer: TextLayer; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const updateText = useEditorStore((s) => s.updateText);
  const tick = useRuntimeTick();
  const { width: cw, height: ch } = useContext(CanvasDims);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Auto-height: the textarea always shows every line it contains (its own
  // wrapping is the ground truth while typing) — no clipped lines, no scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [
    layer.text,
    layer.fontSize,
    layer.fontWeight,
    layer.width,
    layer.lineHeight,
    layer.fontFamily,
    tick,
  ]);

  return (
    <textarea
      ref={ref}
      value={layer.text}
      onChange={(e) => updateText(layer.id, { text: e.target.value.slice(0, 2000) })}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onDone();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      spellCheck={false}
      aria-label="Edit text"
      style={{
        position: "absolute",
        left: pctX(layer.x, cw),
        top: pctY(layer.y, ch),
        width: pctX(layer.width, cw),
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        zIndex: 950,
        resize: "none",
        overflow: "hidden",
        background: "rgba(255,255,255,0.14)",
        outline: "2px solid #fff",
        borderRadius: "0.6cqh",
        border: "none",
        padding: 0,
        color: layer.color,
        fontFamily: layer.fontFamily,
        fontWeight: layer.fontWeight,
        fontSize: cqh(layer.fontSize, ch),
        lineHeight: layer.lineHeight,
        textAlign: layer.align,
        caretColor: layer.color,
        touchAction: "none",
      }}
    />
  );
}
