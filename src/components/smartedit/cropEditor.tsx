"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Crop Mode: the dedicated full-screen image crop editor.

   Opens from the Smart Edit editor when an IMAGE layer is selected
   (action bar “Crop” / inspector “Crop image”). While open it covers the
   whole editor — the main canvas chrome cannot receive any interaction —
   and runs its own gesture engine:

     • drag inside the frame     → move the crop frame (crop geometry)
     • corner + edge handles     → resize the crop viewport (ratio-locked
                                   when a preset is active, free otherwise)
     • Rotate mode               → reorient the composition in 90° steps
     • ratio strip               → Original / Free / 1:1 / 4:5 / 3:4 / 3:2 /
                                   16:9 / 9:16

   THE PHOTO IS FROZEN. The image's on-screen position and size (the
   session zoom/offset) are derived when Crop Mode opens and are never
   changed by pointer interaction: dragging, touching, pinching or
   scrolling on the photo cannot move or scale it. Ordinary gestures edit
   the CROP GEOMETRY only — the frame is moved/resized OVER the fixed
   photo via editCropViewport (crop.ts), which compensates the session
   offset so the photo's screen rect stays bit-for-bit identical. The
   Smart Edit layer transform (x/y/width/height/rotation) is untouched
   until Done. Only the dedicated controls that legitimately re-present
   the photo may do so: the 90° Rotate buttons, Reset and workspace
   resizes.

   The session state (rotation, zoom, offset, viewport rect) lives in THIS
   component — the editor store is only touched once, on Done, producing a
   single history entry (main-editor Undo reverts the whole crop, Redo
   restores it). Inside Crop Mode, Undo/Redo operate on the session stack
   with the same snapshot → live update → finalize pattern the editor uses
   for drags (one entry per gesture, dropped when nothing changed).

   All geometry derives from crop.ts — the same math the canvas renderer,
   the export renderer and the public viewer use, so what the user frames
   here is exactly what renders everywhere. The IMAGE COVERAGE RULE (the
   photo always fully backs the crop viewport) is enforced by
   clampCropSession on every mutation.

   Performance: pointer events only record coordinates; ALL geometry work
   (one workspace rect read + one clamped state update) happens once per
   animation frame, and the photo is a single CSS-transformed <img> that is
   never re-decoded. The Smart Edit editor behind the overlay does not
   re-render during crop gestures (the store is untouched until Done).
─────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ImageLayer } from "./types";
import {
  CROP_MIN_VIEWPORT_PX,
  CROP_PRESETS,
  CROP_WORKSPACE_MARGIN,
  type CropPresetId,
  type CropSession,
  clampCropSession,
  cropFromSession,
  cropLayerPatch,
  editCropViewport,
  fitRectAspect,
  rotatedImageDims,
  sameCrop,
  sessionFromCrop,
} from "./crop";
import {
  IconCrop,
  IconRedo,
  IconRotateLeft,
  IconRotateRight,
  IconUndo,
  IconButton,
} from "./editor-ui";

/* Handle metrics — visually compact, generous hit areas (like the editor's
   selection overlay: the visible handle and the touch target differ). */
const CORNER_VISUAL = 24;
const CORNER_HIT = 44;
const EDGE_BAR_LONG = 30;
const EDGE_BAR_THICK = 4;
const EDGE_HIT_LONG = 44;
const EDGE_HIT_THICK = 26;
/** Absolute floor for a viewport axis while resizing (extreme ratios on
 *  tiny workspaces may still produce a smaller side via the ratio fit). */
const VP_MIN_FLOOR = 28;
/** Keyboard nudge step for handles / image pan (px). */
const NUDGE_PX = 4;
/** Gesture history cap. */
const HISTORY_LIMIT = 50;

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface CropEditorProps {
  layer: ImageLayer;
  resolvedUrl: string;
  /** commit: layer patch (or null when nothing changed) */
  onDone: (patch: Partial<ImageLayer> | null) => void;
  onCancel: () => void;
}

interface HistoryEntry {
  session: CropSession;
  preset: CropPresetId;
}

/**
 * A live gesture — single-pointer by design. Crop Mode edits CROP GEOMETRY
 * over a photo whose on-screen position/size is frozen (editCropViewport),
 * so there is no multi-pointer photo manipulation: a second finger (or a
 * wheel/pinch) never starts anything and never moves or scales the photo.
 */
type Gesture =
  | { kind: "move"; pointerId: number; start: CropSession; startPointer: { x: number; y: number } }
  | { kind: "handle"; pointerId: number; handle: HandleId; start: CropSession };

interface WorkspaceDims {
  width: number;
  height: number;
}

export function CropEditor({ layer, resolvedUrl, onDone, onCancel }: CropEditorProps) {
  const natural = {
    width: Math.max(1, layer.natural.width),
    height: Math.max(1, layer.natural.height),
  };

  const [imgReady, setImgReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [session, setSession] = useState<CropSession | null>(null);
  const [preset, setPreset] = useState<CropPresetId>("original");
  const [mode, setMode] = useState<"crop" | "rotate">("crop");

  const wsRef = useRef<HTMLDivElement>(null);
  /** Workspace size mirror for the gesture engine (no per-event rect reads). */
  const wsDimsRef = useRef<WorkspaceDims | null>(null);
  const [wsState, setWsState] = useState<WorkspaceDims | null>(null);
  const sessionRef = useRef<CropSession | null>(null);
  const presetRef = useRef<CropPresetId>("original");
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastNudgeRef = useRef(0);
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  /** Stack LENGTHS in state — render needs them for the Undo/Redo buttons
   * (the stacks themselves stay in refs; mutations sync the counts). */
  const [histCounts, setHistCounts] = useState({ past: 0, future: 0 });
  const syncHist = useCallback(() => {
    setHistCounts({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  /* ── Preload the image (the workspace <img> then paints from cache) ──── */

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setImgReady(true);
    img.onerror = () => alive && setImgError(true);
    img.src = resolvedUrl;
    return () => {
      alive = false;
    };
  }, [resolvedUrl]);

  /* ── Workspace measurement (ResizeObserver, never per pointer) ───────── */

  useLayoutEffect(() => {
    const el = wsRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = el.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return;
        const next = { width: rect.width, height: rect.height };
        const prev = wsDimsRef.current;
        if (prev && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5) {
          return;
        }
        wsDimsRef.current = next;
        setWsState(next);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ── Session apply / init ─────────────────────────────────────────────── */

  const applySession = useCallback((next: CropSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const applyPreset = useCallback((id: CropPresetId) => {
    presetRef.current = id;
    setPreset(id);
  }, []);

  /** Initialise (or re-clamp) the session once the workspace is known. */
  useEffect(() => {
    const ws = wsDimsRef.current;
    if (!ws || !imgReady) return;
    if (sessionRef.current) {
      // Viewport resized mid-session: keep the crop, re-clamp geometry.
      applySession(
        clampCropSession(sessionRef.current, rotatedImageDims(natural, sessionRef.current.rotation), ws),
      );
      return;
    }
    const initial = sessionFromCrop(layer.crop, natural, ws);
    applySession(initial);
    // Pick the preset matching the restored crop's aspect.
    const aspect = initial.vp.w / initial.vp.h;
    const dims = rotatedImageDims(natural, initial.rotation);
    let id: CropPresetId = "free";
    if (!layer.crop) {
      id = "original";
    } else if (Math.abs(aspect - dims.width / dims.height) < 0.01) {
      id = "original";
    } else {
      const match = CROP_PRESETS.find((p) => p.ratio !== null && Math.abs(p.ratio - aspect) < 0.01);
      if (match) id = match.id;
    }
    applyPreset(id);
    // Runs once per workspace/image readiness; `natural` and `layer.crop`
    // are constant for the lifetime of this overlay (the store is frozen
    // while Crop Mode is open), so they are intentionally not deps.
  }, [wsState, imgReady]);

  /* ── History (session-level; the document gets ONE entry on Done) ─────── */

  const pushHistory = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), { session: current, preset: presetRef.current }];
    futureRef.current = [];
    syncHist();
  }, [syncHist]);

  const dropLastHistory = useCallback(() => {
    if (pastRef.current.length === 0) return;
    pastRef.current = pastRef.current.slice(0, -1);
    syncHist();
  }, [syncHist]);

  const sessionsEqual = useCallback((a: CropSession, b: CropSession) => {
    return (
      a.rotation === b.rotation &&
      Math.abs(a.zoom - b.zoom) < 0.01 &&
      Math.abs(a.offset.x - b.offset.x) < 0.5 &&
      Math.abs(a.offset.y - b.offset.y) < 0.5 &&
      Math.abs(a.vp.x - b.vp.x) < 0.5 &&
      Math.abs(a.vp.y - b.vp.y) < 0.5 &&
      Math.abs(a.vp.w - b.vp.w) < 0.5 &&
      Math.abs(a.vp.h - b.vp.h) < 0.5
    );
  }, []);

  const undo = useCallback(() => {
    const past = pastRef.current;
    const current = sessionRef.current;
    if (past.length === 0 || !current) return;
    const entry = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, { session: current, preset: presetRef.current }];
    applySession(entry.session);
    applyPreset(entry.preset);
    syncHist();
  }, [applyPreset, applySession, syncHist]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    const current = sessionRef.current;
    if (future.length === 0 || !current) return;
    const entry = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, { session: current, preset: presetRef.current }];
    applySession(entry.session);
    applyPreset(entry.preset);
    syncHist();
  }, [applyPreset, applySession, syncHist]);

  /* ── Gesture engine (rAF-batched, clamped through crop.ts) ────────────── */

  const runGesture = useCallback(() => {
    const gesture = gestureRef.current;
    const pendingClient = pendingRef.current;
    const wsEl = wsRef.current;
    if (!gesture || !pendingClient || !wsEl) return;
    // ONE rect read per frame; client → workspace-local for every consumer.
    const rect = wsEl.getBoundingClientRect();
    const pending = { x: pendingClient.x - rect.left, y: pendingClient.y - rect.top };
    const ws = { width: rect.width, height: rect.height };

    // Both gestures edit the CROP VIEWPORT through editCropViewport, which
    // holds the photo's on-screen rect exactly fixed (offset compensation):
    // a drag can move/resize the frame, never the photo itself.
    const start = gesture.start;
    const rotated = rotatedImageDims(natural, start.rotation);

    if (gesture.kind === "move") {
      applySession(
        editCropViewport(start, rotated, ws, {
          x: start.vp.x + (pending.x - gesture.startPointer.x),
          y: start.vp.y + (pending.y - gesture.startPointer.y),
          w: start.vp.w,
          h: start.vp.h,
        }),
      );
      return;
    }

    const ratio = activeRatio(presetRef.current, rotated);
    applySession(
      editCropViewport(
        start,
        rotated,
        ws,
        resizeViewport(gesture.handle, pending, start, ratio, ws),
        ratio,
      ),
    );
  }, [applySession, natural]);

  const scheduleGesture = useCallback(
    (clientX: number, clientY: number) => {
      pendingRef.current = { x: clientX, y: clientY };
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          runGesture();
        });
      }
    },
    [runGesture],
  );

  const onWorkspacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = sessionRef.current;
      if (!current) return;
      if (gestureRef.current) return; // a gesture already owns the interaction
      const rect = wsRef.current?.getBoundingClientRect();
      if (!rect) return;
      const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const { vp } = current;
      // Only the crop frame is a pointer target: a drag that starts INSIDE
      // the frame moves the frame (crop geometry). A drag on the photo
      // outside the frame — or anywhere else in the workspace — starts
      // nothing: the photo's presentation is frozen for the whole session.
      const inside =
        local.x >= vp.x && local.x <= vp.x + vp.w && local.y >= vp.y && local.y <= vp.y + vp.h;
      if (!inside) return;
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // best-effort capture (stale pointer ids throw)
      }
      pushHistory();
      gestureRef.current = {
        kind: "move",
        pointerId: event.pointerId,
        start: current,
        startPointer: local,
      };
    },
    [pushHistory],
  );

  const onWorkspacePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      scheduleGesture(event.clientX, event.clientY);
    },
    [scheduleGesture],
  );

  const finishGesture = useCallback(
    (compareFrom: CropSession) => {
      // An ultra-fast gesture (down + move + up inside one frame) would
      // otherwise lose its final position to the cancelled rAF — apply the
      // last pending update synchronously before finalizing.
      if (pendingRef.current && gestureRef.current) {
        runGesture();
      }
      // Drop the history entry when the whole touch sequence changed nothing.
      if (sessionRef.current && sessionsEqual(compareFrom, sessionRef.current)) {
        dropLastHistory();
      }
      gestureRef.current = null;
      pendingRef.current = null;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    },
    [dropLastHistory, runGesture, sessionsEqual],
  );

  const endPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      // Only the pointer that owns the active gesture finalizes it; any
      // other pointer (e.g. a second finger) is ignored — Crop Mode has no
      // multi-pointer photo manipulation.
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // pointer already released
      }
      finishGesture(gesture.start);
    },
    [finishGesture],
  );

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, handle: HandleId) => {
      const current = sessionRef.current;
      if (!current) return;
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // best-effort capture
      }
      pushHistory();
      gestureRef.current = { kind: "handle", pointerId: event.pointerId, handle, start: current };
    },
    [pushHistory],
  );

  const onHandlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.kind !== "handle" || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      scheduleGesture(event.clientX, event.clientY);
    },
    [scheduleGesture],
  );

  const onHandlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.kind !== "handle" || gesture.pointerId !== event.pointerId) return;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // pointer already released
      }
      finishGesture(gesture.start);
    },
    [finishGesture],
  );

  /* ── Actions: ratio, rotate, reset ────────────────────────────────────── */

  const choosePreset = useCallback(
    (id: CropPresetId) => {
      const current = sessionRef.current;
      const ws = wsDimsRef.current;
      if (!current || !ws) return;
      if (id === presetRef.current && id !== "free") return; // already active
      applyPreset(id);
      if (id === "free") return; // unlock only
      const rotated = rotatedImageDims(natural, current.rotation);
      const ratio = activeRatio(id, rotated);
      if (ratio === null) return;
      pushHistory();
      const fit = fitRectAspect({ width: current.vp.w, height: current.vp.h }, ratio);
      // A ratio change is a crop-geometry edit: the re-fitted frame is
      // clamped over the FROZEN photo (never a photo re-presentation).
      applySession(
        editCropViewport(
          current,
          rotated,
          ws,
          {
            x: current.vp.x + (current.vp.w - fit.width) / 2,
            y: current.vp.y + (current.vp.h - fit.height) / 2,
            w: fit.width,
            h: fit.height,
          },
          ratio,
        ),
      );
    },
    [applyPreset, applySession, natural, pushHistory],
  );

  const rotateBy = useCallback(
    (degrees: number) => {
      const current = sessionRef.current;
      const ws = wsDimsRef.current;
      if (!current || !ws) return;
      pushHistory();
      const rotation = current.rotation + degrees;
      // The photo pivots around its own centre: the offset is kept and the
      // coverage clamps re-fit zoom/pan for the swapped axes.
      applySession(clampCropSession({ ...current, rotation }, rotatedImageDims(natural, rotation), ws));
    },
    [applySession, natural, pushHistory],
  );

  const resetCrop = useCallback(() => {
    const ws = wsDimsRef.current;
    if (!ws) return;
    pushHistory();
    applyPreset("original");
    applySession(sessionFromCrop(undefined, natural, ws));
  }, [applyPreset, applySession, natural, pushHistory, wsDimsRef]);

  /* ── Done ─────────────────────────────────────────────────────────────── */

  const done = useCallback(() => {
    const current = sessionRef.current;
    if (!current) {
      onDone(null);
      return;
    }
    const crop = cropFromSession(current, rotatedImageDims(natural, current.rotation));
    if (sameCrop(crop, layer.crop)) {
      onDone(null);
      return;
    }
    onDone(cropLayerPatch(layer, crop));
  }, [layer, natural, onDone]);

  /* ── Keyboard: Escape / Enter / undo-redo + arrow nudges ──────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        done();
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, onCancel, redo, undo]);

  /** Coalesced history push for key-repeat nudges (one entry per burst). */
  const nudgeHistory = useCallback(() => {
    const now = Date.now();
    if (now - lastNudgeRef.current > 600) pushHistory();
    lastNudgeRef.current = now;
  }, [pushHistory]);

  /** Move the crop frame with arrow keys while the workspace owns the focus
   *  (the photo stays fixed — the same freeze as pointer drags). */
  const onWorkspaceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const current = sessionRef.current;
      const ws = wsDimsRef.current;
      if (!current || !ws) return;
      const step = event.shiftKey ? NUDGE_PX * 4 : NUDGE_PX;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else return;
      event.preventDefault();
      nudgeHistory();
      applySession(
        editCropViewport(
          current,
          rotatedImageDims(natural, current.rotation),
          ws,
          { x: current.vp.x + dx, y: current.vp.y + dy, w: current.vp.w, h: current.vp.h },
        ),
      );
    },
    [applySession, natural, nudgeHistory],
  );

  /** Resize the viewport with arrow keys while a handle owns the focus. */
  const onHandleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, handle: HandleId) => {
      const current = sessionRef.current;
      const ws = wsDimsRef.current;
      if (!current || !ws) return;
      const step = event.shiftKey ? NUDGE_PX * 4 : NUDGE_PX;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else return;
      event.preventDefault();
      nudgeHistory();
      const point = handlePoint(handle, current.vp);
      const rotated = rotatedImageDims(natural, current.rotation);
      const ratio = activeRatio(presetRef.current, rotated);
      applySession(
        editCropViewport(
          current,
          rotated,
          ws,
          resizeViewport(handle, { x: point.x + dx, y: point.y + dy }, current, ratio, ws),
          ratio,
        ),
      );
    },
    [applySession, natural, nudgeHistory],
  );

  /* ── Unmount hygiene ──────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      gestureRef.current = null;
    };
  }, []);

  /* ── Derived display values ───────────────────────────────────────────── */

  const ready = imgReady && !!session;
  const cropW = session ? session.vp.w / session.zoom : 0;
  const cropH = session ? session.vp.h / session.zoom : 0;
  const indicator = session
    ? `${preset === "original" ? "Original" : preset === "free" ? "Free" : preset.toUpperCase()} · ${Math.max(1, Math.round(cropW))} × ${Math.max(1, Math.round(cropH))}`
    : "";
  const canUndo = histCounts.past > 0;
  const canRedo = histCounts.future > 0;

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div
      className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-[#0a0a0a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      role="dialog"
      aria-label="Crop image"
    >
      {/* top toolbar */}
      <header className="relative z-30 grid h-72 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 border-b border-white/8 px-15 s:h-82 s:px-25">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel crop"
          className="flex size-40 items-center justify-center rounded-full bg-white/8 text-white/85 transition-colors duration-300 hover:bg-white/13"
        >
          <span className="text-22 leading-none">×</span>
        </button>

        <div className="min-w-0 text-center" aria-live="polite">
          <p className="truncate text-13 tracking-[-0.02em] text-white/85">{indicator || "Crop image"}</p>
          <p className="mt-2 truncate text-10 text-white/40">
            {mode === "rotate" ? "Rotate turns the photo · drag the frame to reposition" : "Drag inside the frame · drag the handles to resize"}
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-6">
          <IconButton label="Undo" onClick={undo} disabled={!canUndo}>
            <IconUndo />
          </IconButton>
          <IconButton label="Redo" onClick={redo} disabled={!canRedo}>
            <IconRedo />
          </IconButton>
          <button
            type="button"
            onClick={resetCrop}
            disabled={!ready}
            className="whitespace-nowrap rounded-full border border-white/12 bg-white/5 px-13 py-10 text-12 tracking-[-0.02em] text-white transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={done}
            disabled={!ready}
            className="whitespace-nowrap rounded-full bg-white px-16 py-10 text-12 tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </header>

      {/* workspace */}
      <div
        ref={wsRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-clip bg-[#0a0a0a]"
        style={{ touchAction: "none" }}
        role="application"
        aria-label="Crop workspace — drag inside the frame to move it, use the handles to resize"
        tabIndex={0}
        onPointerDown={onWorkspacePointerDown}
        onPointerMove={onWorkspacePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onWorkspaceKeyDown}
      >
        {imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-20 text-center">
            <p className="text-15 tracking-[-0.03em] text-white/60">This image could not be loaded.</p>
            <p className="text-11 text-white/30">Close crop mode and try again.</p>
          </div>
        ) : !ready || !session ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="size-44 rounded-full border-2 border-white/12"
              style={{ borderTopColor: "rgba(255,255,255,0.55)", animation: "se-crop-spin 0.9s linear infinite" }}
              role="status"
              aria-label="Loading image"
            />
          </div>
        ) : (
          <CropWorkspace
            session={session}
            natural={natural}
            resolvedUrl={resolvedUrl}
            onHandlePointerDown={onHandlePointerDown}
            onHandlePointerMove={onHandlePointerMove}
            onHandlePointerUp={onHandlePointerUp}
            onHandleKeyDown={onHandleKeyDown}
          />
        )}
      </div>

      {/* bottom controls */}
      <nav
        aria-label="Crop controls"
        className="relative z-30 shrink-0 border-t border-white/8 bg-[#0c0c0c] px-10 pt-8"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-fit gap-4" role="tablist" aria-label="Crop mode">
          {(
            [
              { id: "crop", label: "Crop", icon: <IconCrop /> },
              { id: "rotate", label: "Rotate", icon: <IconRotateLeft /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex min-h-36 items-center gap-6 rounded-full px-16 text-11 tracking-[-0.01em] transition-colors ${
                mode === tab.id ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "crop" ? (
          <div
            className="mt-8 overflow-x-auto"
            style={{ touchAction: "pan-x", overscrollBehavior: "contain", scrollbarWidth: "none" }}
            aria-label="Aspect ratio"
          >
            <div className="flex w-max gap-6 px-2 py-2">
              {CROP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => choosePreset(p.id)}
                  disabled={!ready}
                  className={`min-h-36 whitespace-nowrap rounded-full px-14 text-11 tracking-[-0.01em] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                    preset === p.id ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-8 grid max-w-[420px] grid-cols-2 gap-10">
            <button
              type="button"
              onClick={() => rotateBy(-90)}
              disabled={!ready}
              className="flex min-h-44 items-center justify-center gap-8 rounded-14 border border-white/10 bg-white/[0.04] py-11 text-12 text-white transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <IconRotateLeft />
              Rotate left
            </button>
            <button
              type="button"
              onClick={() => rotateBy(90)}
              disabled={!ready}
              className="flex min-h-44 items-center justify-center gap-8 rounded-14 border border-white/10 bg-white/[0.04] py-11 text-12 text-white transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <IconRotateRight />
              Rotate right
            </button>
          </div>
        )}
      </nav>

      <style>{`@keyframes se-crop-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Workspace: image + viewport + grid + handles ───────────────────────── */

function CropWorkspace({
  session,
  natural,
  resolvedUrl,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onHandleKeyDown,
}: {
  session: CropSession;
  natural: { width: number; height: number };
  resolvedUrl: string;
  onHandlePointerDown: (event: ReactPointerEvent<HTMLDivElement>, handle: HandleId) => void;
  onHandlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandleKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>, handle: HandleId) => void;
}) {
  const { vp, zoom, offset, rotation } = session;
  const imgCentre = { x: vp.x + vp.w / 2 + offset.x, y: vp.y + vp.h / 2 + offset.y };

  const gridLine: CSSProperties = {
    position: "absolute",
    background: "rgba(255,255,255,0.30)",
    pointerEvents: "none",
  };

  const handleCursors: Record<HandleId, string> = {
    nw: "nwse-resize",
    n: "ns-resize",
    ne: "nesw-resize",
    e: "ew-resize",
    se: "nwse-resize",
    s: "ns-resize",
    sw: "nesw-resize",
    w: "ew-resize",
  };
  const handleLabels: Record<HandleId, string> = {
    nw: "Crop top left corner",
    n: "Crop top edge",
    ne: "Crop top right corner",
    e: "Crop right edge",
    se: "Crop bottom right corner",
    s: "Crop bottom edge",
    sw: "Crop bottom left corner",
    w: "Crop left edge",
  };

  return (
    <>
      {/* the photo — one <img>, CSS-transformed; never re-decoded per frame */}
      <img
        src={resolvedUrl}
        alt="Photo being cropped"
        draggable={false}
        style={{
          position: "absolute",
          left: imgCentre.x,
          top: imgCentre.y,
          width: natural.width * zoom,
          height: natural.height * zoom,
          // Tailwind's preflight clamps imgs to max-width:100% — the photo
          // must be free to overflow the workspace while zoomed in.
          maxWidth: "none",
          maxHeight: "none",
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* the frame interior — the move affordance for the crop geometry.
          Pointer events bubble to the workspace, which only starts a frame
          move when the drag begins INSIDE this rect; the photo itself is
          inert (pointer-events: none) and never moves or scales. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: vp.x,
          top: vp.y,
          width: vp.w,
          height: vp.h,
          cursor: "move",
          touchAction: "none",
        }}
      />

      {/* dim everything outside the crop viewport (clipped by the workspace) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: vp.x,
          top: vp.y,
          width: vp.w,
          height: vp.h,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
          pointerEvents: "none",
        }}
      />

      {/* crop frame + 3×3 composition grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: vp.x,
          top: vp.y,
          width: vp.w,
          height: vp.h,
          border: "1.5px solid #fff",
          pointerEvents: "none",
        }}
      >
        <div style={{ ...gridLine, left: "33.333%", top: 0, bottom: 0, width: 1 }} />
        <div style={{ ...gridLine, left: "66.666%", top: 0, bottom: 0, width: 1 }} />
        <div style={{ ...gridLine, top: "33.333%", left: 0, right: 0, height: 1 }} />
        <div style={{ ...gridLine, top: "66.666%", left: 0, right: 0, height: 1 }} />
      </div>

      {/* handles — corner brackets + edge bars, compact visuals, big hit areas */}
      {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((handle) => {
        const pos = handlePoint(handle, vp);
        const corner = handle.length === 2;
        const horizontal = handle === "e" || handle === "w";
        const visual: CSSProperties = corner
          ? {
              width: CORNER_VISUAL,
              height: CORNER_VISUAL,
              borderColor: "#fff",
              borderStyle: "solid",
              borderWidth: 0,
              borderTopWidth: handle.includes("n") ? 3 : 0,
              borderBottomWidth: handle.includes("s") ? 3 : 0,
              borderLeftWidth: handle.includes("w") ? 3 : 0,
              borderRightWidth: handle.includes("e") ? 3 : 0,
            }
          : {
              width: horizontal ? EDGE_BAR_THICK : EDGE_BAR_LONG,
              height: horizontal ? EDGE_BAR_LONG : EDGE_BAR_THICK,
              borderRadius: 999,
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            };
        return (
          <div
            key={handle}
            role="button"
            aria-label={handleLabels[handle]}
            title={handleLabels[handle]}
            tabIndex={0}
            onPointerDown={(e) => onHandlePointerDown(e, handle)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            onKeyDown={(e) => onHandleKeyDown(e, handle)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: corner ? CORNER_HIT : horizontal ? EDGE_HIT_THICK : EDGE_HIT_LONG,
              height: corner ? CORNER_HIT : horizontal ? EDGE_HIT_LONG : EDGE_HIT_THICK,
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              touchAction: "none",
              cursor: handleCursors[handle],
              outline: "none",
            }}
          >
            <div style={visual} />
          </div>
        );
      })}
    </>
  );
}

/* ── Pure helpers used by the gesture engine ────────────────────────────── */

/** The active aspect ratio for a preset id (null = free / unlocked). */
function activeRatio(
  preset: CropPresetId,
  rotated: { width: number; height: number },
): number | null {
  if (preset === "free") return null;
  if (preset === "original") return rotated.width / rotated.height;
  return CROP_PRESETS.find((p) => p.id === preset)?.ratio ?? null;
}

/** Centre point of a handle on the viewport rect. */
function handlePoint(handle: HandleId, vp: CropSession["vp"]): { x: number; y: number } {
  const x = handle.includes("w") ? vp.x : handle.includes("e") ? vp.x + vp.w : vp.x + vp.w / 2;
  const y = handle.includes("n") ? vp.y : handle.includes("s") ? vp.y + vp.h : vp.y + vp.h / 2;
  return { x, y };
}

/**
 * Desired viewport rect for a handle drag at `pointer` (workspace-local),
 * anchored at the opposite corner (corner handles) or the opposite edge
 * centre (edge handles; the perpendicular axis grows symmetrically while a
 * ratio is locked). Pure — final size/position clamping happens in
 * clampCropSession, which also enforces the coverage rule.
 */
function resizeViewport(
  handle: HandleId,
  pointer: { x: number; y: number },
  start: CropSession,
  ratio: number | null,
  ws: WorkspaceDims,
): CropSession["vp"] {
  const vp = start.vp;
  const corner = handle.length === 2;
  const horizontal = handle === "e" || handle === "w";
  const vertical = handle === "n" || handle === "s";

  // Anchor: the side(s) opposite the dragged handle stay fixed.
  const ax = handle.includes("w") ? vp.x + vp.w : vp.x;
  const ay = handle.includes("n") ? vp.y + vp.h : vp.y;
  const towardEast = handle.includes("e") || (corner && !handle.includes("w"));
  const towardSouth = handle.includes("s") || (corner && !handle.includes("n"));

  let w: number;
  let h: number;
  if (corner) {
    w = Math.abs(pointer.x - ax);
    h = Math.abs(pointer.y - ay);
    if (ratio !== null) {
      if (w >= h * ratio) h = w / ratio;
      else w = h * ratio;
    }
  } else if (horizontal) {
    w = Math.abs(pointer.x - ax);
    h = ratio !== null ? w / ratio : vp.h;
  } else if (vertical) {
    h = Math.abs(pointer.y - ay);
    w = ratio !== null ? h * ratio : vp.w;
  } else {
    return vp;
  }

  // Room available from the anchor toward the dragged side (the frame must
  // stay inside the workspace so the handles remain reachable).
  const roomW = towardEast ? ws.width - CROP_WORKSPACE_MARGIN - ax : ax - CROP_WORKSPACE_MARGIN;
  const roomH = towardSouth ? ws.height - CROP_WORKSPACE_MARGIN - ay : ay - CROP_WORKSPACE_MARGIN;
  const maxW = Math.max(CROP_MIN_VIEWPORT_PX, roomW);
  const maxH = Math.max(CROP_MIN_VIEWPORT_PX, roomH);
  w = Math.min(w, maxW);
  h = Math.min(h, maxH);
  if (ratio !== null) {
    // Re-fit the ratio inside the allowed box (scaling the larger side
    // down keeps the gesture responsive in the dominant direction).
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    // Keep extreme ratios usable: never smaller than the floor on either
    // axis (tiny workspaces may still clip via clampCropSession).
    if (w < VP_MIN_FLOOR || h < VP_MIN_FLOOR) {
      w = Math.max(w, VP_MIN_FLOOR);
      h = Math.max(h, VP_MIN_FLOOR);
      if (w / h > ratio) w = h * ratio;
      else h = w / ratio;
    }
  } else {
    w = Math.max(CROP_MIN_VIEWPORT_PX, w);
    h = Math.max(CROP_MIN_VIEWPORT_PX, h);
  }

  let x: number;
  let y: number;
  if (corner) {
    x = towardEast ? ax : ax - w;
    y = towardSouth ? ay : ay - h;
  } else if (horizontal) {
    x = towardEast ? ax : ax - w;
    y = ratio !== null ? vp.y + vp.h / 2 - h / 2 : vp.y;
  } else {
    x = ratio !== null ? vp.x + vp.w / 2 - w / 2 : vp.x;
    y = towardSouth ? ay : ay - h;
  }
  return { x, y, w, h };
}
