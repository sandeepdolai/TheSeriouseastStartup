"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   The canvas renderer. One component draws a SmartEditDocument at ANY size:
   the wrapper carries the canvas aspect ratio + container-type:size, layers
   position themselves with % units and size text with cqh units, so the exact
   same markup serves the editor, My Projects previews and the public viewer.

   interactive=true connects the component to the editor store (selection,
   move / resize / rotate, text editing). interactive=false is a pure renderer.
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
} from "react";
import {
  type Layer,
  type SmartEditDocument,
  type TextLayer,
  clamp,
  isImageLike,
  snapRotation,
} from "./types";
import { layoutTextLayer, onFontsChanged } from "./textLayout";
import { assetUrl, onAssetsChanged } from "./assets";
import { useEditorStore } from "./store";

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

/* ── Scale variable: keeps selection handles a constant screen size ─────── */

function useScaleVar(
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  designWidth: number,
) {
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) el.style.setProperty("--se-scale", String(rect.width / designWidth));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [wrapperRef, designWidth]);
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

  return (
    <div style={style} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={layer.type === "sticker" ? "Sticker" : "Image"}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }}
        />
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

type DragMode = "move" | "rotate" | "resize-corner" | "resize-width";

interface DragState {
  mode: DragMode;
  layerId: string;
  startPointer: { x: number; y: number };
  startLayer: Layer;
  startAngle: number;
  startDistance: number;
}

export interface SmartEditCanvasProps {
  document: SmartEditDocument;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SmartEditCanvas({
  document: staticDocument,
  interactive = false,
  className,
  style,
}: SmartEditCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const tapRef = useRef<{ id: string; time: number } | null>(null);

  const storeDocument = useEditorStore((s) => (interactive ? s.document : null));
  const selection = useEditorStore((s) => (interactive ? s.selection : null));
  const editingId = useEditorStore((s) => (interactive ? s.editingId : null));
  const assetsVersion = useEditorStore((s) => (interactive ? s.assetsVersion : 0));

  const document = interactive ? storeDocument! : staticDocument;
  useScaleVar(wrapperRef, document.canvas.width);
  useRuntimeTick();
  void assetsVersion;

  const store = useEditorStore;

  const toDesignUnits = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapperRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const scale = rect.width / document.canvas.width || 1;
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [document.canvas.width],
  );

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
      dragRef.current = {
        mode,
        layerId: layer.id,
        startPointer: pointer,
        startLayer: { ...layer },
        startAngle: Math.atan2(pointer.y - layer.y, pointer.x - layer.x),
        startDistance: Math.hypot(pointer.x - layer.x, pointer.y - layer.y),
      };
      store.getState().snapshot();
    },
    [interactive, store, toDesignUnits],
  );

  const applyDrag = useCallback(() => {
    const pending = pendingMoveRef.current;
    const drag = dragRef.current;
    if (!pending || !drag) return;
    pendingMoveRef.current = null;
    const pointer = toDesignUnits(pending.clientX, pending.clientY);
    const start = drag.startLayer;
    const state = store.getState();

    if (drag.mode === "move") {
      state.updateLayerLive(drag.layerId, {
        x: start.x + (pointer.x - drag.startPointer.x),
        y: start.y + (pointer.y - drag.startPointer.y),
      });
      return;
    }

    if (drag.mode === "rotate") {
      const angle = Math.atan2(pointer.y - start.y, pointer.x - start.x);
      let deg = start.rotation + ((angle - drag.startAngle) * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      state.updateLayerLive(drag.layerId, { rotation: snapRotation(deg) });
      return;
    }

    if (drag.mode === "resize-corner") {
      const ratio =
        drag.startDistance > 4
          ? Math.hypot(pointer.x - start.x, pointer.y - start.y) / drag.startDistance
          : 1;
      if (start.type === "text") {
        state.updateLayerLive(drag.layerId, {
          fontSize: clamp(Math.round(start.fontSize * ratio), 8, 720),
          width: clamp(Math.round(start.width * ratio), 60, document.canvas.width * 2),
        });
      } else {
        state.updateLayerLive(drag.layerId, {
          width: Math.max(24, Math.round(start.width * ratio)),
          height: Math.max(24, Math.round(start.height * ratio)),
        });
      }
      return;
    }

    if (drag.mode === "resize-width" && start.type === "text") {
      const rad = (start.rotation * Math.PI) / 180;
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;
      const projection = dx * Math.cos(rad) + dy * Math.sin(rad);
      state.updateLayerLive(drag.layerId, {
        width: clamp(Math.round(Math.abs(projection) * 2), 60, document.canvas.width * 2),
      });
    }
  }, [document.canvas.width, store, toDesignUnits]);

  const endDrag = useCallback(
    (event: ReactPointerEvent<Element>) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      dragRef.current = null;
      pendingMoveRef.current = null;
      try {
        (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
      } catch {
        // pointer already released
      }
      const state = store.getState();
      const current = state.document.layers.find((l) => l.id === drag.layerId);
      const start = drag.startLayer;
      const unchanged =
        !current ||
        (current.x === start.x &&
          current.y === start.y &&
          current.width === start.width &&
          current.height === start.height &&
          current.rotation === start.rotation &&
          (current.type !== "text" ||
            start.type !== "text" ||
            current.fontSize === start.fontSize));
      if (unchanged) state.dropLastSnapshot();
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
      if (!dragRef.current) return;
      event.preventDefault();
      pendingMoveRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          applyDrag();
        });
      }
    },
    [applyDrag],
  );

  const selectedLayer = document.layers.find((l) => l.id === selection) ?? null;
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
          overflow: interactive ? "visible" : "hidden",
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

        {/* selection frame */}
        {interactive && selectedLayer && !editingId && (
          <SelectionFrame layer={selectedLayer} onBeginDrag={beginDrag} />
        )}

        {/* text editing overlay */}
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

/* ── Selection frame + handles ──────────────────────────────────────────── */

function handleBox(): CSSProperties {
  return {
    position: "absolute",
    width: "calc(14px / var(--se-scale, 1))",
    height: "calc(14px / var(--se-scale, 1))",
    borderRadius: "999px",
    background: "#fff",
    border: "calc(1.5px / var(--se-scale, 1)) solid rgba(10,10,10,0.85)",
    boxShadow: "0 calc(1px / var(--se-scale, 1)) calc(3px / var(--se-scale, 1)) rgba(0,0,0,0.3)",
  };
}

/** 34px (screen) touch-friendly hit area wrapping a handle */
function hitArea(extra: CSSProperties = {}): CSSProperties {
  return {
    position: "absolute",
    width: "calc(34px / var(--se-scale, 1))",
    height: "calc(34px / var(--se-scale, 1))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "none",
    pointerEvents: "auto",
    ...extra,
  };
}

function SelectionFrame({
  layer,
  onBeginDrag,
}: {
  layer: Layer;
  onBeginDrag: (event: ReactPointerEvent<Element>, mode: DragMode, layer: Layer) => void;
}) {
  const { width: cw, height: ch } = useContext(CanvasDims);

  return (
    <div
      style={{
        position: "absolute",
        left: pctX(layer.x, cw),
        top: pctY(layer.y, ch),
        width: pctX(layer.width, cw),
        height: pctY(layer.height, ch),
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        zIndex: 900,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "calc(2px / var(--se-scale, 1))",
          outline: "calc(1.5px / var(--se-scale, 1)) solid #fff",
          boxShadow: "0 0 0 calc(1px / var(--se-scale, 1)) rgba(10,10,10,0.35)",
        }}
      />

      {/* corner resize handles */}
      <div style={hitArea({ left: 0, top: 0, transform: "translate(-50%, -50%)", cursor: "nwse-resize" })} onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)}>
        <div style={{ ...handleBox(), cursor: "nwse-resize" }} />
      </div>
      <div style={hitArea({ right: 0, top: 0, transform: "translate(50%, -50%)", cursor: "nesw-resize" })} onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)}>
        <div style={{ ...handleBox(), cursor: "nesw-resize" }} />
      </div>
      <div style={hitArea({ left: 0, bottom: 0, transform: "translate(-50%, 50%)", cursor: "nesw-resize" })} onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)}>
        <div style={{ ...handleBox(), cursor: "nesw-resize" }} />
      </div>
      <div style={hitArea({ right: 0, bottom: 0, transform: "translate(50%, 50%)", cursor: "nwse-resize" })} onPointerDown={(e) => onBeginDrag(e, "resize-corner", layer)}>
        <div style={{ ...handleBox(), cursor: "nwse-resize" }} />
      </div>

      {/* text width handles */}
      {layer.type === "text" && (
        <>
          <div style={hitArea({ left: 0, top: "50%", transform: "translate(-50%, -50%)", cursor: "ew-resize" })} onPointerDown={(e) => onBeginDrag(e, "resize-width", layer)}>
            <div style={{ ...handleBox(), borderRadius: "calc(3px / var(--se-scale, 1))", cursor: "ew-resize" }} />
          </div>
          <div style={hitArea({ right: 0, top: "50%", transform: "translate(50%, -50%)", cursor: "ew-resize" })} onPointerDown={(e) => onBeginDrag(e, "resize-width", layer)}>
            <div style={{ ...handleBox(), borderRadius: "calc(3px / var(--se-scale, 1))", cursor: "ew-resize" }} />
          </div>
        </>
      )}

      {/* rotate handle */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          transform: "translate(-50%, -100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div style={hitArea({ position: "relative", cursor: "grab" })} onPointerDown={(e) => onBeginDrag(e, "rotate", layer)}>
          <div
            style={{
              ...handleBox(),
              background: "#0a0a0a",
              border: "calc(1.5px / var(--se-scale, 1)) solid #fff",
              cursor: "grab",
            }}
          />
        </div>
        <div
          style={{
            width: "calc(1.5px / var(--se-scale, 1))",
            height: "calc(12px / var(--se-scale, 1))",
            background: "#fff",
            boxShadow: "0 0 0 calc(1px / var(--se-scale, 1)) rgba(10,10,10,0.35)",
            marginTop: "calc(-2px / var(--se-scale, 1))",
            marginBottom: "calc(1px / var(--se-scale, 1))",
          }}
        />
      </div>
    </div>
  );
}

/* ── Text editing overlay ───────────────────────────────────────────────── */

function TextEditorOverlay({ layer, onDone }: { layer: TextLayer; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const updateText = useEditorStore((s) => s.updateText);
  const { width: cw, height: ch } = useContext(CanvasDims);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

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
