/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Editor state (zustand). Holds the project document + selection + history.
   Assets are referenced by id (never embedded), so history snapshots stay
   lightweight no matter how many photos are on the canvas.
─────────────────────────────────────────────────────────────────────────── */

import { create } from "zustand";
import {
  type AssetRecord,
  type CanvasRatio,
  type Layer,
  type SmartEditDocument,
  type TextLayer,
  CANVAS_RATIOS,
  clamp,
  createDocument,
  newLayerId,
} from "./types";
import { textLayerHeight } from "./textLayout";

const HISTORY_LIMIT = 60;

export interface EditorStore {
  projectId: string;
  title: string;
  document: SmartEditDocument;
  selection: string | null;
  /** layer currently in text-edit mode */
  editingId: string | null;
  past: SmartEditDocument[];
  future: SmartEditDocument[];
  /** bumped whenever assets resolve so layers re-render */
  assetsVersion: number;
  fontsVersion: number;
  dirty: boolean;
  /** id of the most recently added layer (for entrance feedback) */
  justAdded: string | null;

  reset: (projectId: string, title: string, document: SmartEditDocument) => void;
  setTitle: (title: string) => void;

  select: (id: string | null) => void;
  startEditing: (id: string | null) => void;
  bumpAssets: () => void;
  bumpFonts: () => void;

  addLayer: (layer: Layer) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  updateLayer: (id: string, patch: Partial<Layer>, options?: { history?: boolean }) => void;
  /** live transform updates during drags — no history entries */
  updateLayerLive: (id: string, patch: Partial<Layer>) => void;
  /** remove the newest history snapshot (drag ended without changes) */
  dropLastSnapshot: () => void;
  updateText: (id: string, patch: Partial<TextLayer>) => void;
  reorderLayer: (id: string, direction: 1 | -1) => void;
  moveLayerToIndex: (id: string, index: number) => void;
  setBackground: (color: string) => void;

  /** history control for drag interactions */
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  projectId: "",
  title: "Smart Edit",
  document: createDocument("4:5"),
  selection: null,
  editingId: null,
  past: [],
  future: [],
  assetsVersion: 0,
  fontsVersion: 0,
  dirty: false,
  justAdded: null,

  reset: (projectId, title, document) =>
    set({
      projectId,
      title,
      document,
      selection: null,
      editingId: null,
      past: [],
      future: [],
      dirty: false,
      justAdded: null,
    }),

  setTitle: (title) => set({ title, dirty: true }),

  select: (id) => set({ selection: id }),
  startEditing: (id) => set({ editingId: id, selection: id }),
  bumpAssets: () => set((s) => ({ assetsVersion: s.assetsVersion + 1 })),
  bumpFonts: () => set((s) => ({ fontsVersion: s.fontsVersion + 1 })),

  addLayer: (layer) =>
    set((s) => ({
      document: { ...s.document, layers: [...s.document.layers, layer] },
      past: [...s.past, s.document].slice(-HISTORY_LIMIT),
      future: [],
      selection: layer.id,
      dirty: true,
      justAdded: layer.id,
    })),

  deleteLayer: (id) =>
    set((s) => {
      if (s.document.layers.every((l) => l.id !== id)) return s;
      return {
        document: {
          ...s.document,
          layers: s.document.layers.filter((l) => l.id !== id),
        },
        past: [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: [],
        selection: s.selection === id ? null : s.selection,
        editingId: s.editingId === id ? null : s.editingId,
        dirty: true,
      };
    }),

  duplicateLayer: (id) =>
    set((s) => {
      const index = s.document.layers.findIndex((l) => l.id === id);
      if (index < 0) return s;
      const source = s.document.layers[index];
      const copy = clone(source);
      copy.id = newLayerId();
      copy.x = clamp(source.x + 36, 0, s.document.canvas.width);
      copy.y = clamp(source.y + 36, 0, s.document.canvas.height);
      const layers = [...s.document.layers];
      layers.splice(index + 1, 0, copy);
      return {
        document: { ...s.document, layers },
        past: [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: [],
        selection: copy.id,
        dirty: true,
        justAdded: copy.id,
      };
    }),

  updateLayer: (id, patch, options) =>
    set((s) => {
      const layers = s.document.layers.map((l) =>
        l.id === id ? ({ ...l, ...patch } as Layer) : l,
      );
      if (layers === s.document.layers) return s;
      return {
        document: { ...s.document, layers },
        past: options?.history === false ? s.past : [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: options?.history === false ? s.future : [],
        dirty: true,
      };
    }),

  updateLayerLive: (id, patch) =>
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, ...patch } as Layer;
          const textPatch = patch as Partial<TextLayer>;
          if (next.type === "text" && (textPatch.fontSize !== undefined || patch.width !== undefined || textPatch.text !== undefined)) {
            next.height = textLayerHeight(next);
          }
          return next;
        }),
      },
      dirty: true,
    })),

  dropLastSnapshot: () =>
    set((s) => ({ past: s.past.slice(0, -1) })),

  updateText: (id, patch) =>
    set((s) => {
      const layers = s.document.layers.map((l) => {
        if (l.id !== id || l.type !== "text") return l;
        const next = { ...l, ...patch } as TextLayer;
        next.height = textLayerHeight(next);
        return next;
      });
      return {
        document: { ...s.document, layers },
        past: [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
      };
    }),

  reorderLayer: (id, direction) =>
    set((s) => {
      const index = s.document.layers.findIndex((l) => l.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= s.document.layers.length) return s;
      const layers = [...s.document.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(target, 0, layer);
      return {
        document: { ...s.document, layers },
        past: [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
      };
    }),

  moveLayerToIndex: (id, index) =>
    set((s) => {
      const from = s.document.layers.findIndex((l) => l.id === id);
      if (from < 0 || index < 0 || index >= s.document.layers.length || from === index) return s;
      const layers = [...s.document.layers];
      const [layer] = layers.splice(from, 1);
      layers.splice(index, 0, layer);
      return {
        document: { ...s.document, layers },
        past: [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
      };
    }),

  setBackground: (color) =>
    set((s) => ({
      document: { ...s.document, background: { type: "color", color } },
      past: [...s.past, s.document].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    })),

  snapshot: () => set((s) => ({ past: [...s.past, s.document].slice(-HISTORY_LIMIT), future: [] })),

  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1];
      if (!previous) return s;
      return {
        document: previous,
        past: s.past.slice(0, -1),
        future: [s.document, ...s.future].slice(0, HISTORY_LIMIT),
        selection: s.selection && previous.layers.some((l) => l.id === s.selection) ? s.selection : null,
        editingId: null,
        dirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        document: next,
        past: [...s.past, s.document].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        selection: s.selection && next.layers.some((l) => l.id === s.selection) ? s.selection : null,
        editingId: null,
        dirty: true,
      };
    }),

  markSaved: () => set({ dirty: false }),
}));

/* ── Layer factories ────────────────────────────────────────────────────── */

export function makeTextLayer(
  document: SmartEditDocument,
  overrides: Partial<TextLayer> = {},
): TextLayer {
  const base: TextLayer = {
    id: newLayerId(),
    type: "text",
    x: document.canvas.width / 2,
    y: document.canvas.height / 2,
    width: Math.round(document.canvas.width * 0.7),
    height: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: "Your text",
    fontId: "diatype",
    fontFamily: "sans",
    fontSize: Math.round(document.canvas.width * 0.09),
    fontWeight: 500,
    color: "#1c1b18",
    align: "center",
    lineHeight: 1.2,
    ...overrides,
  };
  base.height = textLayerHeight(base);
  return base;
}

export function makeImageLayer(
  document: SmartEditDocument,
  record: AssetRecord,
  type: "image" | "sticker",
): Layer {
  const natural = { width: record.width || 400, height: record.height || 400 };
  const maxW = document.canvas.width * 0.62;
  const maxH = document.canvas.height * 0.62;
  const scale = Math.min(maxW / natural.width, maxH / natural.height, 1);
  const width = Math.max(40, Math.round(natural.width * scale));
  const height = Math.max(40, Math.round(natural.height * scale));
  const url = record.provider === "local" ? "" : record.url ?? "";
  return {
    id: newLayerId(),
    type,
    assetId: record.id,
    url,
    natural,
    x: document.canvas.width / 2,
    y: document.canvas.height / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
  };
}

export function ratioForDocument(document: SmartEditDocument): CanvasRatio | null {
  for (const [key, preset] of Object.entries(CANVAS_RATIOS)) {
    if (preset.width === document.canvas.width && preset.height === document.canvas.height) {
      return key as CanvasRatio;
    }
  }
  return null;
}
