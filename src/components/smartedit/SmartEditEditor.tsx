"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit editor shell.

   Layout (Paper Stish native — same surfaces, transitions and dark language
   as the template editor):
   • header: close · title · undo/redo · save · export
   • desktop (s:): tool rail on the left, canvas centre, inspector right
   • mobile: bottom tool dock, panels as bottom sheets
   Persistence is DEVICE-FIRST: the editable project lives on this
   device — debounced IndexedDB draft (700ms) + account-scoped project
   record in IndexedDB (3s autosave / manual save). The server is only
   contacted when the user presses Publish.
─────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { signIn, useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { isAdminEmail } from "@/lib/admin";
import {
  getLocalProject,
  listAllLocalProjects,
  listLocalProjects,
  putLocalProject,
} from "@/lib/localProjects";
import {
  type AssetRecord,
  type Layer,
  type LibraryManifest,
  type SmartEditDocument,
  type TextLayer,
  BUILTIN_FONTS,
  clamp,
  isImageLike,
  safeColor,
} from "./types";
import {
  assetDataUrl,
  assetUrl,
  getAsset,
  hydrateAssets,
  idb,
  importFontFile,
  importImageFile,
  libraryItemToAsset,
  loadLibraryManifest,
  registerAsset,
  registerFontFromDataUrl,
  resolvePublicPath,
  restoreUserFont,
  pruneOrphanAssets,
  listUploads,
} from "./assets";
import { makeImageLayer, makeTextLayer, useEditorStore } from "./store";
import { clearTextLayoutCache, layoutTextLayer, onFontsChanged } from "./textLayout";
import { SmartEditCanvas } from "./SmartEditCanvas";
import { SelectionOverlay } from "./selectionOverlay";
import { exportDocument } from "./exportRenderer";
import {
  AuthGate,
  IconDelete,
  IconDelete as DelIcon,
  IconDown,
  IconDownload,
  IconDuplicate,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLayers,
  IconLibrary,
  IconLock,
  IconRedo,
  IconText,
  IconUndo,
  IconUnlock,
  IconUp,
  IconUpload,
  IconButton,
  ModalShell,
  SheetShell,
  ToolButton,
} from "./editor-ui";

interface SmartEditEditorProps {
  projectId: string;
  onClose: () => void;
}

type LoadState = { phase: "loading" } | { phase: "ready" } | { phase: "missing" };

export function SmartEditEditor({ projectId, onClose }: SmartEditEditorProps) {
  const { data: session, status } = useSession();
  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [exportScale, setExportScale] = useState(2);
  const [exporting, setExporting] = useState(false);
  const [authGate, setAuthGate] = useState<"save" | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"stickers" | "photos" | "uploads">("stickers");
  const [manifest, setManifest] = useState<LibraryManifest | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [uploadsVersion, setUploadsVersion] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [adminTemplateDraft, setAdminTemplateDraft] = useState(false);
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [templatePublishError, setTemplatePublishError] = useState("");

  const title = useEditorStore((s) => s.title);
  const doc = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const editingId = useEditorStore((s) => s.editingId);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const dirty = useEditorStore((s) => s.dirty);
  const selectedLayer = useMemo(
    () => doc.layers.find((l) => l.id === selection) ?? null,
    [doc.layers, selection],
  );

  const bootedRef = useRef(false);
  const draftTimer = useRef<number | null>(null);
  const projectTimer = useRef<number | null>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  /* ── Project load + draft recovery ─────────────────────────────────── */

  useEffect(() => {
    if (status === "loading") return;
    if (bootedRef.current) return;
    bootedRef.current = true;
    let alive = true;

    const boot = async () => {
      // Device-first: the editable project lives on this device. The stored
      // record and the debounced draft are compared and the freshest
      // document wins — no server round-trip while editing.
      const record = await getLocalProject(getAccountKey(session?.user?.email), projectId);
      const projectData = (record?.data ?? null) as {
        kind?: string;
        document?: SmartEditDocument;
        assets?: Record<string, AssetRecord>;
      } | null;

      if (alive) {
        setAdminTemplateDraft(isAdminEmail(session?.user?.email));
      }

      const draft = await idb.getDraft<{
        document: SmartEditDocument;
        title?: string;
        savedAt: number;
      }>(projectId);

      const ts = (value?: string | number) =>
        value ? (typeof value === "number" ? value : Date.parse(value) || 0) : 0;

      // Freshest document wins: stored record vs IndexedDB draft (the
      // draft is written most often, so it wins timestamp ties).
      const candidates: {
        document: SmartEditDocument;
        at: number;
        title: string;
        assets: AssetRecord[];
      }[] = [];
      if (projectData?.document) {
        candidates.push({
          document: projectData.document,
          at: ts(record?.updatedAt),
          title: record?.title ?? "Smart Edit",
          assets: Object.values(projectData.assets ?? {}) as AssetRecord[],
        });
      }
      if (draft?.document) {
        candidates.push({
          document: draft.document,
          at: ts(draft.savedAt),
          title: draft.title || record?.title || "Smart Edit",
          assets: Object.values(projectData?.assets ?? {}) as AssetRecord[],
        });
      }

      let best: (typeof candidates)[number] | null = null;
      for (const candidate of candidates) {
        if (!best || candidate.at >= best.at) best = candidate;
      }

      if (!best || !best.document.canvas || !Array.isArray(best.document.layers)) {
        if (alive) setLoad({ phase: "missing" });
        return;
      }
      const loaded = best.document;

      await hydrateAssets(best.assets);

      // Re-register user fonts (FontFace) referenced by the document — from
      // IndexedDB when the blob exists locally, otherwise from the data url
      // embedded in the document (e.g. restored from another browser).
      await Promise.all(
        (loaded.fonts ?? [])
          .filter((f) => f.source === "user")
          .map(async (f) => {
            const asset = best.assets.find((a) => a.id === f.id);
            const family = asset ? await restoreUserFont(asset) : null;
            if (!family && f.dataUrl) await registerFontFromDataUrl(f.id, f.family, f.dataUrl);
          }),
      );

      useEditorStore.getState().reset(projectId, best.title || "Smart Edit", loaded);
      if (alive) setLoad({ phase: "ready" });

      // Housekeeping: drop stored blobs no project on this device
      // references anymore (conservative — every account is considered).
      const referenced = new Set<string>();
      for (const project of await listAllLocalProjects()) {
        if (project.templateSlug !== "smart-edit") continue;
        const data = project.data as { assets?: Record<string, AssetRecord> } | undefined;
        for (const id of Object.keys(data?.assets ?? {})) referenced.add(id);
      }
      void pruneOrphanAssets(referenced);
    };

    void boot();
    return () => {
      alive = false;
    };
  }, [projectId, session?.user?.email, status]);

  /* ── Library manifest ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!libraryOpen || manifest) return;
    void loadLibraryManifest().then(setManifest);
  }, [libraryOpen, manifest]);

  // "My uploads" lists every image the account has stored, across its
  // local projects (device-first: this device's records only).
  useEffect(() => {
    if (!libraryOpen || libraryTab !== "uploads") return;
    let alive = true;
    void listLocalProjects(getAccountKey(session?.user?.email)).then((projects) => {
      if (!alive) return;
      const records: AssetRecord[] = [];
      for (const project of projects) {
        if (project.templateSlug !== "smart-edit") continue;
        const data = project.data as { assets?: Record<string, AssetRecord> } | undefined;
        for (const asset of Object.values(data?.assets ?? {})) {
          if (asset?.type === "image") records.push(asset);
        }
      }
      if (records.length > 0) {
        void hydrateAssets(records).then(() => setUploadsVersion((v) => v + 1));
      }
    });
    return () => {
      alive = false;
    };
  }, [libraryOpen, libraryTab, session?.user?.email]);

  /* ── Persistence: debounced draft + project autosave ──────────────── */

  const account = getAccountKey(session?.user?.email);

  const snapshotAssets = useCallback((document: SmartEditDocument): Record<string, AssetRecord> => {
    const out: Record<string, AssetRecord> = {};
    for (const layer of document.layers) {
      if (isImageLike(layer)) {
        const record = getAsset(layer.assetId);
        if (record) out[record.id] = record;
      }
    }
    for (const font of document.fonts ?? []) {
      if (font.source !== "user") continue;
      const record = getAsset(font.id);
      if (record) out[record.id] = record;
    }
    return out;
  }, []);

  const writeProjectRecord = useCallback(
    async () => {
      if (status !== "authenticated") return false;
      const state = useEditorStore.getState();
      const ok = await putLocalProject({
        id: projectId,
        account,
        title: state.title,
        templateSlug: "smart-edit",
        updatedAt: new Date().toISOString(),
        data: {
          kind: "smart-edit",
          document: state.document,
          assets: snapshotAssets(state.document),
        },
      });
      if (ok) state.markSaved();
      return ok;
    },
    [projectId, account, snapshotAssets, status],
  );

  const flushDraft = useCallback(() => {
    const state = useEditorStore.getState();
    if (!state.projectId) return;
    void idb.putDraft(projectId, {
      document: state.document,
      title: state.title,
      savedAt: Date.now(),
    });
  }, [projectId]);

  useEffect(() => {
    if (load.phase !== "ready") return;
    let lastDoc = useEditorStore.getState().document;
    let lastTitle = useEditorStore.getState().title;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.document === lastDoc && state.title === lastTitle) return;
      lastDoc = state.document;
      lastTitle = state.title;

      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
      draftTimer.current = window.setTimeout(flushDraft, 700);

      if (state.dirty) {
        if (projectTimer.current !== null) window.clearTimeout(projectTimer.current);
        projectTimer.current = window.setTimeout(() => {
          if (useEditorStore.getState().dirty) {
            void writeProjectRecord();
          }
        }, 3000);
      }
    });
    return () => {
      unsubscribe();
      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
      if (projectTimer.current !== null) window.clearTimeout(projectTimer.current);
      flushDraft();
    };
  }, [load.phase, flushDraft, writeProjectRecord]);

  /* ── Unload protection ────────────────────────────────────────────── */

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useEditorStore.getState().dirty) return;
      flushDraft();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushDraft]);

  /* ── Keyboard height (visual viewport) ───────────────────────────── */
  // --se-kb = how far the on-screen keyboard (or other browser UI) covers
  // the bottom of the layout viewport. Sheets and modals anchor above it so
  // their content can never end up behind the keyboard. Android browsers
  // resize the layout viewport itself, so the value stays 0 there.
  useEffect(() => {
    const main = mainRef.current;
    const vv = window.visualViewport;
    if (!main || !vv) return;
    const apply = () => {
      const covered = Math.max(0, window.innerHeight - vv.height);
      main.style.setProperty("--se-kb", `${Math.round(covered)}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    return () => vv.removeEventListener("resize", apply);
  }, []);

  /* ── Header height (runtime) ───────────────────────────────────── */
  // --se-header-h = the real rendered height of the editor header, measured
  // live (ResizeObserver). Mobile sheets start exactly at its bottom edge —
  // no rem-coupled constant, correct through any viewport / font scale.
  useEffect(() => {
    const main = mainRef.current;
    const header = headerRef.current;
    if (!main || !header) return;
    const apply = () => {
      main.style.setProperty("--se-header-h", `${Math.round(header.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  /* ── Font metrics → text re-measurement ────────────────────────── */
  // Text layers may have been measured with FALLBACK font metrics (fonts
  // load asynchronously; font-display: swap). When the real typefaces
  // arrive, re-derive every text height from fresh metrics so the stored
  // document — and with it the selection overlay — matches the re-rendered
  // text exactly. No history entry: this is a measurement correction.
  useEffect(() => {
    if (load.phase !== "ready") return;
    const remeasure = () => {
      useEditorStore.getState().remeasureTextLayers();
    };
    const offFonts = onFontsChanged(remeasure);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      clearTextLayoutCache();
      remeasure();
    });
    return () => {
      alive = false;
      offFonts();
    };
  }, [load.phase]);

  /* ── Mode isolation: sheets vs text editing ────────────────────── */
  // Opening any sheet/modal leaves text-editing mode (the typed text is
  // already committed to the store) — no caret stays active behind an open
  // sheet. Closing a sheet never touches the editing state.
  const sheetsOpen =
    libraryOpen || inspectorOpen || exportOpen || !!authGate || textEditorOpen;
  const prevSheetsOpenRef = useRef(false);
  useEffect(() => {
    if (sheetsOpen && !prevSheetsOpenRef.current) {
      const state = useEditorStore.getState();
      if (state.editingId) state.startEditing(null);
    }
    prevSheetsOpenRef.current = sheetsOpen;
  }, [sheetsOpen]);

  useEffect(() => {
    if (textEditorOpen && selectedLayer?.type !== "text") {
      setTextEditorOpen(false);
    }
  }, [selectedLayer, textEditorOpen]);

  /* ── Save / publish / export ──────────────────────────────────────── */

  const publishTemplate = useCallback(async () => {
    if (!adminTemplateDraft || !isAdminEmail(session?.user?.email) || publishingTemplate) return;

    const state = useEditorStore.getState();
    const templateTitle = state.title.trim();
    if (!templateTitle) {
      setTemplatePublishError("Give the template a name first.");
      return;
    }

    setPublishingTemplate(true);
    setTemplatePublishError("");

    try {
      const document = structuredClone(state.document);
      const assets = snapshotAssets(document);

      for (const layer of document.layers) {
        if (!isImageLike(layer)) continue;
        const record = assets[layer.assetId];
        if (!record) continue;

        let url = record.url ?? "";
        if (record.provider === "local") {
          url = (await assetDataUrl(record.id)) ?? "";
        }
        if (!url) throw new Error(`The asset "${record.name}" is not available for publishing.`);

        layer.url = url;
        assets[record.id] = {
          ...record,
          provider: "bundled",
          url,
          storeKey: undefined,
        };
      }

      for (const font of document.fonts ?? []) {
        if (font.source !== "user") continue;
        const record = assets[font.id];
        if (!record) continue;

        const dataUrl = font.dataUrl || (
          record.provider === "local" ? await assetDataUrl(record.id) : record.url
        );
        if (!dataUrl) throw new Error(`The font "${record.name}" is not available for publishing.`);

        font.dataUrl = dataUrl;
        assets[record.id] = {
          ...record,
          provider: "bundled",
          url: dataUrl,
          storeKey: undefined,
        };
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: templateTitle,
          document,
          assets,
        }),
      });

      if (!res.ok) {
        let message = "Could not publish the template.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // keep default message
        }
        throw new Error(message);
      }

      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setTemplatePublishError(
        err instanceof Error ? err.message : "Could not publish the template.",
      );
    } finally {
      setPublishingTemplate(false);
    }
  }, [
    adminTemplateDraft,
    publishingTemplate,
    session?.user?.email,
    snapshotAssets,
  ]);

  const save = useCallback(async () => {
    if (status !== "authenticated") {
      setAuthGate("save");
      return;
    }
    flushDraft();
    const ok = await writeProjectRecord();
    if (ok) {
      setSaveError("");
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1400);
    } else {
      setSaveError("Could not save this project on this device. Try again.");
    }
  }, [flushDraft, status, writeProjectRecord]);

  const saveAndClose = useCallback(() => {
    flushDraft();
    if (useEditorStore.getState().dirty && status === "authenticated") {
      void writeProjectRecord();
    }
    onClose();
  }, [flushDraft, onClose, status, writeProjectRecord]);

  const runExport = useCallback(async () => {
    try {
      setExporting(true);
      await exportDocument(useEditorStore.getState().document, {
        format: exportFormat,
        scale: exportScale,
      });
      setExportOpen(false);
    } catch {
      setLibraryError("Could not export the image. Try again.");
    } finally {
      setExporting(false);
    }
  }, [exportFormat, exportScale]);

  /* ── Tool actions ─────────────────────────────────────────────────── */

  const addText = useCallback(() => {
    const state = useEditorStore.getState();
    const layer = makeTextLayer(state.document);
    state.addLayer(layer);
    state.startEditing(layer.id);
  }, []);

  const addLibraryItem = useCallback((record: AssetRecord) => {
    const state = useEditorStore.getState();
    registerAsset(record);
    state.addLayer(
      makeImageLayer(state.document, record, record.type === "sticker" ? "sticker" : "image"),
    );
  }, []);

  const onUploadImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLibraryError("");
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const { record } = await importImageFile(file);
        const state = useEditorStore.getState();
        state.addLayer(makeImageLayer(state.document, record, "image"));
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : "Could not add that image.");
      }
    }
    setUploadsVersion((v) => v + 1);
  }, []);

  const onImportFont = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setLibraryError("");
    try {
      const { id, family } = await importFontFile(file);
      const state = useEditorStore.getState();
      const fontRef = { id, family, source: "user" as const };
      if (!state.document.fonts.some((f) => f.id === id)) {
        useEditorStore.setState({
          document: { ...state.document, fonts: [...state.document.fonts, fontRef] },
          dirty: true,
        });
      }
      const layer = state.selection
        ? state.document.layers.find((l) => l.id === state.selection)
        : null;
      if (layer && layer.type === "text") {
        useEditorStore.getState().updateText(layer.id, { fontId: id, fontFamily: family });
      }
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Could not import that font.");
    }
  }, []);

  const deleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    if (state.selection) state.deleteLayer(state.selection);
  }, []);

  const duplicateSelected = useCallback(() => {
    const state = useEditorStore.getState();
    if (state.selection) state.duplicateLayer(state.selection);
  }, []);

  const editSelectedText = useCallback(() => {
    const state = useEditorStore.getState();
    const layer = state.selection
      ? state.document.layers.find((item) => item.id === state.selection)
      : null;
    if (!layer || layer.type !== "text" || layer.locked) return;

    // Edit Text opens the formatting editor. It deliberately does NOT enter
    // canvas text-edit mode, so clicking the header button never summons the
    // mobile keyboard by itself. The keyboard appears only when the user
    // explicitly taps the words field inside the editor.
    state.startEditing(null);
    setInspectorOpen(false);
    setTextEditorOpen(true);
  }, []);

  /* ── Keyboard shortcuts ───────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (load.phase !== "ready") return;
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const state = useEditorStore.getState();
      if (typing || state.editingId) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && state.selection) {
        event.preventDefault();
        state.deleteLayer(state.selection);
        return;
      }
      if (event.key === "Escape") {
        state.select(null);
        return;
      }
      if (event.key.startsWith("Arrow") && state.selection) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const layer = state.document.layers.find((l) => l.id === state.selection);
        if (!layer) return;
        const patch: { x?: number; y?: number } = {};
        if (event.key === "ArrowUp") patch.y = layer.y - step;
        if (event.key === "ArrowDown") patch.y = layer.y + step;
        if (event.key === "ArrowLeft") patch.x = layer.x - step;
        if (event.key === "ArrowRight") patch.x = layer.x + step;
        state.updateLayer(layer.id, patch);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load.phase]);

  /* ── Render ───────────────────────────────────────────────────────── */

  if (load.phase === "missing") {
    return (
      <main className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <p className="text-20 tracking-[-0.04em]">Project not found</p>
        <p className="mt-8 text-12 text-white/40">This Smart Edit project is no longer available.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-20 rounded-full bg-white px-18 py-10 text-12 text-black"
        >
          Back to My Projects
        </button>
      </main>
    );
  }

  return (
    <main
      ref={mainRef}
      className="fixed inset-0 z-50 flex min-h-0 flex-col bg-[#0a0a0a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* header */}
      <header
        ref={headerRef}
        className="relative z-30 grid h-72 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 border-b border-white/8 px-15 s:h-82 s:px-25"
      >
        <button
          type="button"
          onClick={saveAndClose}
          aria-label="Close Smart Edit"
          className="flex size-40 items-center justify-center rounded-full bg-white/8 text-white/85 transition-colors duration-300 hover:bg-white/13"
        >
          <span className="text-22 leading-none">×</span>
        </button>

        <div className="min-w-0 text-center">
          <p className="truncate text-15 tracking-[-0.04em]">Smart Edit</p>
          <input
            value={title}
            onChange={(e) => useEditorStore.getState().setTitle(e.target.value.slice(0, 60))}
            aria-label="Project title"
            className="mx-auto mt-2 block w-full max-w-[220px] truncate rounded-8 border border-transparent bg-transparent text-center text-10 text-white/45 outline-none focus:border-white/20"
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-6">
          <IconButton label="Undo" onClick={() => useEditorStore.getState().undo()} disabled={!canUndo}>
            <IconUndo />
          </IconButton>
          <IconButton label="Redo" onClick={() => useEditorStore.getState().redo()} disabled={!canRedo}>
            <IconRedo />
          </IconButton>
          {selectedLayer?.type === "text" && (
            <button
              type="button"
              onClick={editSelectedText}
              className="whitespace-nowrap rounded-full border border-white/12 bg-white/5 px-11 py-9 text-11 tracking-[-0.02em] text-white transition-transform duration-300 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] s:px-14"
              aria-label="Edit selected text"
            >
              Edit Text
            </button>
          )}
          {adminTemplateDraft && (
            <button
              type="button"
              onClick={() => void publishTemplate()}
              disabled={publishingTemplate}
              className="whitespace-nowrap rounded-full bg-white px-12 py-9 text-11 tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45 s:px-14"
            >
              {publishingTemplate ? "Publishing…" : "Publish to All Users"}
            </button>
          )}
          <IconButton label="Download" onClick={() => setExportOpen(true)}>
            <IconDownload />
          </IconButton>
          <button
            type="button"
            onClick={save}
            className="whitespace-nowrap rounded-full border border-white/12 bg-white/5 px-13 py-10 text-12 tracking-[-0.02em] text-white transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] s:px-16"
          >
            {savedFlash ? "Saved" : dirty ? "Save •" : "Save"}
          </button>
        </div>
      </header>

      {/* body */}
      <div className="relative flex min-h-0 flex-1">
        {(saveError || templatePublishError) && (
          <div className="pointer-events-none absolute left-1/2 top-10 z-40 max-w-[min(90%,520px)] -translate-x-1/2 rounded-full border border-[#e5484d]/35 bg-[#241214]/95 px-14 py-8 text-center text-11 leading-14 text-[#ff8f93] shadow-lg">
            {templatePublishError || saveError}
          </div>
        )}
        {/* desktop tool rail */}
        <nav
          aria-label="Smart Edit tools"
          className="hidden w-72 shrink-0 flex-col items-center gap-6 border-r border-white/8 py-15 s:flex"
        >
          <ToolButton label="Add text" onClick={addText}>
            <IconText />
            <span className="text-10 tracking-[-0.01em]">Text</span>
          </ToolButton>
          <ToolButton label="Library" active={libraryOpen} onClick={() => setLibraryOpen((v) => !v)}>
            <IconLibrary />
            <span className="text-10 tracking-[-0.01em]">Library</span>
          </ToolButton>
          <ToolButton label="Upload image" onClick={() => imageFileRef.current?.click()}>
            <IconUpload />
            <span className="text-10 tracking-[-0.01em]">Upload</span>
          </ToolButton>
          <ToolButton label="Layers" active={inspectorOpen} onClick={() => setInspectorOpen((v) => !v)}>
            <IconLayers />
            <span className="text-10 tracking-[-0.01em]">Layers</span>
          </ToolButton>
          <ToolButton label="Export image" onClick={() => setExportOpen(true)}>
            <IconDownload />
            <span className="text-10 tracking-[-0.01em]">Export</span>
          </ToolButton>
          <div className="mt-auto">
            <ToolButton label="Delete selected" onClick={deleteSelected}>
              <span className="text-white/60">
                <IconDelete />
              </span>
              <span className="text-10 tracking-[-0.01em] text-white/60">Delete</span>
            </ToolButton>
          </div>
        </nav>

        {/* canvas workspace — THE editor workspace boundary (TOP: header,
            MIDDLE: this region, BOTTOM: dock). Clipped (`clip`, never a
            scroll container) + isolated so canvas art and selection UI can
            never reach the fixed application chrome. */}
        <div
          ref={workspaceRef}
          className="relative isolate min-h-0 min-w-0 flex-1 overflow-clip bg-[#0d0d0d]"
        >
          <div
            className="absolute inset-0 flex items-center justify-center px-12 py-12 s:px-20 s:py-20"
            style={{ containerType: "size" }}
          >
            {load.phase === "ready" ? (
              <SmartEditCanvas
                interactive
                surfaceRef={canvasRef}
                document={doc}
                style={{
                  width: `min(100cqw, ${(doc.canvas.width / doc.canvas.height) * 100}cqh)`,
                  maxWidth: "100%",
                  borderRadius: "0.6rem",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
                }}
              />
            ) : (
              <div
                className="size-44 rounded-full border-2 border-white/12"
                style={{ borderTopColor: "rgba(255,255,255,0.55)", animation: "se-spin 0.9s linear infinite" }}
                role="status"
                aria-label="Loading project"
              />
            )}
          </div>

          {/* selection / transform interaction layer — clipped to the
              workspace; handles clamp into the usable region */}
          {load.phase === "ready" && <SelectionOverlay canvasRef={canvasRef} />}

          {load.phase === "ready" && doc.layers.length === 0 && !editingId && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 text-center">
              <p className="text-15 tracking-[-0.03em] text-white/30">Your canvas is empty</p>
              <p className="text-11 text-white/20">Add text, stickers or photos from the tools</p>
            </div>
          )}

          {/* floating selection actions */}
          {load.phase === "ready" && selectedLayer && !editingId && (
            <div className="pointer-events-auto absolute left-1/2 top-10 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-[#151515]/95 p-4 shadow-xl backdrop-blur">
              {selectedLayer.type === "text" && (
                <IconButton label="Edit text" onClick={editSelectedText} className="size-34">
                  <IconEdit />
                </IconButton>
              )}
              <IconButton label="Duplicate" onClick={duplicateSelected} className="size-34">
                <IconDuplicate />
              </IconButton>
              <IconButton
                label="Delete"
                onClick={deleteSelected}
                className="size-34 hover:!bg-[#e5484d]/25 hover:!text-[#ff8f93]"
              >
                <IconDelete />
              </IconButton>
            </div>
          )}
        </div>

        {/* desktop inspector */}
        {load.phase === "ready" && (
          <aside className="hidden w-300 shrink-0 flex-col overflow-y-auto border-l border-white/8 bg-[#0e0e0e] s:flex">
            <InspectorContent
              onImportFont={() => fontFileRef.current?.click()}
              onEditWords={() => setInspectorOpen(false)}
            />
          </aside>
        )}
      </div>

      {/* mobile dock */}
      <nav
        aria-label="Smart Edit tools"
        className="relative z-30 flex shrink-0 items-stretch justify-around gap-4 border-t border-white/8 bg-[#0c0c0c] px-8 pb-10 pt-6 s:hidden"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <ToolButton label="Add text" onClick={addText}>
          <IconText />
          <span className="text-9 tracking-[-0.01em]">Text</span>
        </ToolButton>
        <ToolButton label="Library" onClick={() => setLibraryOpen(true)}>
          <IconLibrary />
          <span className="text-9 tracking-[-0.01em]">Library</span>
        </ToolButton>
        <ToolButton label="Upload image" onClick={() => imageFileRef.current?.click()}>
          <IconUpload />
          <span className="text-9 tracking-[-0.01em]">Upload</span>
        </ToolButton>
        <ToolButton label="Layers" onClick={() => setInspectorOpen(true)}>
          <IconLayers />
          <span className="text-9 tracking-[-0.01em]">Layers</span>
        </ToolButton>
        <ToolButton label="Export image" onClick={() => setExportOpen(true)}>
          <IconDownload />
          <span className="text-9 tracking-[-0.01em]">Export</span>
        </ToolButton>
        <ToolButton label="Delete selected" onClick={deleteSelected}>
          <span className="text-white/55">
            <IconDelete />
          </span>
          <span className="text-9 tracking-[-0.01em] text-white/55">Delete</span>
        </ToolButton>
      </nav>

      {/* hidden inputs */}
      <input
        ref={imageFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onUploadImages(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={fontFileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        className="hidden"
        onChange={(e) => {
          void onImportFont(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      {/* text editor — formatting controls for the selected text layer */}
      {textEditorOpen && selectedLayer?.type === "text" && (
        <>
          <div className="hidden s:block">
            <ModalShell
              title="Edit Text"
              subtitle="Change the words, font, size, colour and alignment. Changes appear live on the canvas."
              onClose={() => setTextEditorOpen(false)}
              width={500}
            >
              <TextEditorContent
                layer={selectedLayer}
                onImportFont={() => fontFileRef.current?.click()}
              />
            </ModalShell>
          </div>
          <div className="s:hidden">
            <SheetShell title="Edit Text" onClose={() => setTextEditorOpen(false)}>
              <TextEditorContent
                layer={selectedLayer}
                onImportFont={() => fontFileRef.current?.click()}
              />
            </SheetShell>
          </div>
        </>
      )}

      {/* library panel — desktop side panel / mobile sheet */}
      {libraryOpen && load.phase === "ready" && (
        <>
          <div className="absolute left-72 top-0 z-20 hidden h-full w-280 border-r border-white/8 bg-[#101010] s:flex">
            <div className="flex-1 overflow-y-auto p-12">
              <LibraryContent
                manifest={manifest}
                tab={libraryTab}
                setTab={setLibraryTab}
                onAdd={addLibraryItem}
                error={libraryError}
                uploadsVersion={uploadsVersion}
              />
            </div>
          </div>
          <div className="s:hidden">
            <SheetShell title="Library" onClose={() => setLibraryOpen(false)}>
              <LibraryContent
                manifest={manifest}
                tab={libraryTab}
                setTab={setLibraryTab}
                onAdd={addLibraryItem}
                error={libraryError}
                uploadsVersion={uploadsVersion}
              />
            </SheetShell>
          </div>
        </>
      )}

      {/* inspector sheet — mobile */}
      {inspectorOpen && load.phase === "ready" && (
        <div className="s:hidden">
          <SheetShell title="Layers" onClose={() => setInspectorOpen(false)}>
            <InspectorContent
              onImportFont={() => fontFileRef.current?.click()}
              onEditWords={() => setInspectorOpen(false)}
            />
          </SheetShell>
        </div>
      )}

      {/* export modal */}
      {exportOpen && (
        <ModalShell
          title="Export image"
          subtitle="Downloads the artwork only — no editor controls."
          onClose={() => setExportOpen(false)}
        >
          <div className="grid gap-14">
            <div>
              <p className="mb-7 text-10 text-white/45">Format</p>
              <div className="grid grid-cols-2 gap-8">
                {(["png", "jpg"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setExportFormat(format)}
                    className={`rounded-13 border py-11 text-12 transition-colors ${
                      exportFormat === format
                        ? "border-white/60 bg-white/10"
                        : "border-white/10 bg-white/[0.03] text-white/60"
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-7 text-10 text-white/45">Size</p>
              <div className="grid grid-cols-2 gap-8">
                {[1, 2].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setExportScale(scale)}
                    className={`rounded-13 border py-11 text-12 transition-colors ${
                      exportScale === scale
                        ? "border-white/60 bg-white/10"
                        : "border-white/10 bg-white/[0.03] text-white/60"
                    }`}
                  >
                    {scale}× · {Math.round(doc.canvas.width * scale)}×{Math.round(doc.canvas.height * scale)}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={runExport}
              className="mt-4 w-full rounded-full bg-white py-12 text-12 text-black disabled:opacity-40"
            >
              {exporting ? "Exporting…" : "Download"}
            </button>
          </div>
        </ModalShell>
      )}

      {/* auth gate */}
      {authGate && (
        <AuthGate action={authGate} onSignIn={() => signIn("google")} onClose={() => setAuthGate(null)} />
      )}

      <style>{`@keyframes se-spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

const PLACEHOLDER_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function TextEditorContent({
  layer,
  onImportFont,
}: {
  layer: TextLayer;
  onImportFont: () => void;
}) {
  const doc = useEditorStore((s) => s.document);
  const updateText = useEditorStore((s) => s.updateText);

  const fontOptions = useMemo(() => {
    const userFonts = doc.fonts
      .filter((font) => font.source === "user")
      .map((font) => ({
        id: font.id,
        family: font.family,
        name: getAsset(font.id)?.name ?? "My font",
        weights: [400],
      }));
    return [
      ...BUILTIN_FONTS.map((font) => ({
        id: font.id,
        family: font.family,
        name: font.name,
        weights: font.weights,
      })),
      ...userFonts,
    ];
  }, [doc.fonts]);

  const font = fontOptions.find((item) => item.id === layer.fontId);
  const swatches = [
    "#1c1b18", "#ffffff", "#e5484d", "#ff8fab",
    "#f5c518", "#4f9cf9", "#7fc97f", "#b78ef0",
  ];

  return (
    <div className="grid gap-14">
      <label className="grid gap-7">
        <span className="text-10 text-white/45">Words</span>
        <textarea
          value={layer.text}
          onChange={(event) => updateText(layer.id, { text: event.target.value.slice(0, 2000) })}
          rows={4}
          spellCheck={false}
          aria-label="Text content"
          className="min-h-100 w-full resize-y rounded-[13px] border border-white/10 bg-white/5 px-12 py-10 text-13 leading-18 text-white outline-none focus:border-white/30"
        />
      </label>

      <label className="grid gap-7">
        <span className="text-10 text-white/45">Font</span>
        <select
          value={layer.fontId}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "__add__") {
              onImportFont();
              return;
            }
            const next = fontOptions.find((item) => item.id === value);
            if (next) updateText(layer.id, { fontId: next.id, fontFamily: next.family });
          }}
          className="w-full appearance-none rounded-[13px] border border-white/10 bg-white/5 px-12 py-10 text-12 text-white outline-none focus:border-white/25"
          aria-label="Font"
        >
          {fontOptions.map((option) => (
            <option key={option.id} value={option.id} style={{ fontFamily: option.family }} className="bg-[#161616]">
              {option.name}
            </option>
          ))}
          <option value="__add__" className="bg-[#161616]">＋ Import font…</option>
        </select>
      </label>

      {font && font.weights.length > 1 && (
        <div>
          <span className="text-10 text-white/45">Weight</span>
          <div className="mt-7 flex flex-wrap gap-6">
            {font.weights.map((weight) => (
              <button
                key={weight}
                type="button"
                onClick={() => updateText(layer.id, { fontWeight: weight })}
                aria-pressed={layer.fontWeight === weight}
                className={`min-w-44 rounded-full px-10 py-7 text-10 transition-colors ${
                  layer.fontWeight === weight ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
                }`}
                style={{ fontWeight: weight }}
              >
                {weight}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <span className="text-10 text-white/45">Size</span>
          <span className="text-10 text-white/55">{Math.round(layer.fontSize)} px</span>
        </div>
        <div className="mt-7 flex items-center gap-7">
          <button
            type="button"
            onClick={() => updateText(layer.id, { fontSize: clamp(layer.fontSize - 1, 12, 280) })}
            aria-label="Decrease text size"
            className="flex size-34 shrink-0 items-center justify-center rounded-full bg-white/8 text-16 text-white/80 hover:bg-white/14"
          >
            −
          </button>
          <input
            type="range"
            min={12}
            max={280}
            step={1}
            value={clamp(layer.fontSize, 12, 280)}
            onChange={(event) => updateText(layer.id, { fontSize: Number(event.target.value) })}
            aria-label="Font size"
            className="h-30 min-w-0 flex-1 accent-white"
          />
          <button
            type="button"
            onClick={() => updateText(layer.id, { fontSize: clamp(layer.fontSize + 1, 12, 280) })}
            aria-label="Increase text size"
            className="flex size-34 shrink-0 items-center justify-center rounded-full bg-white/8 text-16 text-white/80 hover:bg-white/14"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <span className="text-10 text-white/45">Colour</span>
        <div className="mt-7 flex flex-wrap items-center gap-8">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => updateText(layer.id, { color })}
              aria-label={`Text colour ${color}`}
              aria-pressed={layer.color === color}
              className={`size-30 rounded-full border transition-transform hover:scale-110 ${
                layer.color === color ? "border-white" : "border-white/15"
              }`}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            value={safeColor(layer.color, "#1c1b18")}
            onChange={(event) => updateText(layer.id, { color: event.target.value })}
            aria-label="Custom text colour"
            className="h-30 w-44 cursor-pointer rounded-full border border-white/15 bg-transparent"
          />
        </div>
      </div>

      <div>
        <span className="text-10 text-white/45">Alignment</span>
        <div className="mt-7 grid grid-cols-3 gap-7">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => updateText(layer.id, { align })}
              aria-pressed={layer.align === align}
              className={`rounded-10 py-9 text-10 capitalize transition-colors ${
                layer.align === align ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
              }`}
            >
              {align}
            </button>
          ))}
        </div>
      </div>

      <p className="text-9 leading-13 text-white/30">
        All changes update the selected text on the canvas immediately and are included in undo/redo and autosave.
      </p>
    </div>
  );
}

/* ── Library content ──────────────────────────────────────────────────── */

function LibraryContent({
  manifest,
  tab,
  setTab,
  onAdd,
  error,
  uploadsVersion,
}: {
  manifest: LibraryManifest | null;
  tab: "stickers" | "photos" | "uploads";
  setTab: (tab: "stickers" | "photos" | "uploads") => void;
  onAdd: (record: AssetRecord) => void;
  error: string;
  uploadsVersion: number;
}) {
  const items: AssetRecord[] =
    tab === "stickers"
      ? (manifest?.stickers ?? []).map(libraryItemToAsset)
      : tab === "photos"
        ? (manifest?.photos ?? []).map(libraryItemToAsset)
        : (() => {
            void uploadsVersion;
            return listUploads();
          })();

  return (
    <div>
      <div className="mb-10 flex gap-6">
        {(["stickers", "photos", "uploads"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-12 py-7 text-11 capitalize transition-colors ${
              tab === key ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {error && <p className="mb-8 text-11 leading-15 text-[#ff8f93]">{error}</p>}

      {items.length === 0 ? (
        <p className="py-20 text-center text-11 text-white/35">
          {tab === "uploads" ? "Your uploaded photos appear here." : "Loading…"}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-7 s:grid-cols-4">
          {items.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => onAdd(record)}
              aria-label={`Add ${record.name}`}
              className="group relative aspect-square overflow-hidden rounded-12 border border-white/8 bg-[#171717] transition-all duration-200 hover:border-white/25 active:scale-[0.96]"
            >
              <img
                src={
                  record.provider === "bundled"
                    ? resolvePublicPath(record.url ?? "")
                    : record.url ?? assetUrl(record.id) ?? ""
                }
                alt={record.name}
                loading="lazy"
                draggable={false}
                className="size-full object-contain p-6"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Inspector: properties + layers ───────────────────────────────────── */

function InspectorContent({
  onImportFont,
  onEditWords,
}: {
  onImportFont: () => void;
  onEditWords: () => void;
}) {
  const doc = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const title = useEditorStore((s) => s.title);
  const selected = doc.layers.find((l) => l.id === selection) ?? null;

  const fontOptions = useMemo(() => {
    const userFonts = doc.fonts
      .filter((f) => f.source === "user")
      .map((f) => ({
        id: f.id,
        family: f.family,
        name: getAsset(f.id)?.name ?? "My font",
        weights: [400],
      }));
    return [
      ...BUILTIN_FONTS.map((f) => ({ id: f.id, family: f.family, name: f.name, weights: f.weights })),
      ...userFonts,
    ];
  }, [doc.fonts]);

  return (
    <div className="flex flex-col gap-14 p-15">
      <label className="grid gap-7">
        <span className="text-10 text-white/45">Project title</span>
        <input
          value={title}
          onChange={(e) => useEditorStore.getState().setTitle(e.target.value.slice(0, 60))}
          className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-10 text-12 text-white outline-none focus:border-white/25"
        />
      </label>

      {!selected && <BackgroundSection />}
      {selected?.type === "text" && (
        <TextProperties
          layer={selected}
          fontOptions={fontOptions}
          onImportFont={onImportFont}
          onEditWords={onEditWords}
        />
      )}
      {selected && selected.type !== "text" && <ImageProperties layer={selected} />}

      <LayersSection />
    </div>
  );
}

function BackgroundSection() {
  const background = useEditorStore((s) => s.document.background);
  const setBackground = useEditorStore((s) => s.setBackground);

  const swatches = [
    "#f4efe6", "#ffffff", "#0d0d0d", "#f7e3d3", "#ffd7e0", "#cfe3ff",
    "#d7ecc8", "#fff0c0", "#e5484d", "#14213d", "#f2b5c4", "#b5d8c8",
  ];

  return (
    <section className="rounded-[15px] border border-white/8 bg-white/[0.02] p-12">
      <p className="text-11 tracking-[-0.02em] text-white/70">Background</p>
      <div className="mt-10 grid grid-cols-6 gap-7">
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Background ${color}`}
            onClick={() => setBackground(color)}
            className={`aspect-square rounded-10 border transition-transform hover:scale-105 ${
              background.color === color ? "border-white" : "border-white/15"
            }`}
            style={{ background: color }}
          />
        ))}
      </div>
      <label className="mt-10 flex items-center justify-between gap-10">
        <span className="text-10 text-white/45">Custom colour</span>
        <input
          type="color"
          value={safeColor(background.color, "#f4efe6")}
          onChange={(e) => setBackground(e.target.value)}
          aria-label="Custom background colour"
          className="h-30 w-50 cursor-pointer rounded-8 border border-white/15 bg-transparent"
        />
      </label>
    </section>
  );
}

function TextProperties({
  layer,
  fontOptions,
  onImportFont,
  onEditWords,
}: {
  layer: TextLayer;
  fontOptions: { id: string; family: string; name: string; weights: number[] }[];
  onImportFont: () => void;
  onEditWords: () => void;
}) {
  const updateText = useEditorStore((s) => s.updateText);
  const startEditing = useEditorStore((s) => s.startEditing);
  const font = fontOptions.find((f) => f.id === layer.fontId);
  const lines = layoutTextLayer(layer);

  const swatches = ["#1c1b18", "#ffffff", "#e5484d", "#ff8fab", "#f5c518", "#4f9cf9", "#7fc97f", "#b78ef0"];

  return (
    <section className="rounded-[15px] border border-white/8 bg-white/[0.02] p-12">
      <div className="flex items-center justify-between">
        <p className="text-11 tracking-[-0.02em] text-white/70">Text</p>
        <button
          type="button"
          onClick={() => {
            // Close the sheet first: typing happens on the canvas, never
            // behind an open inspector.
            onEditWords();
            startEditing(layer.id);
          }}
          className="rounded-full bg-white/10 px-10 py-6 text-10 text-white/80 hover:bg-white/16"
        >
          Edit words
        </button>
      </div>

      <label className="mt-10 grid gap-6">
        <span className="text-10 text-white/45">Font</span>
        <select
          value={layer.fontId}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "__add__") {
              onImportFont();
              return;
            }
            const next = fontOptions.find((f) => f.id === value);
            if (next) updateText(layer.id, { fontId: next.id, fontFamily: next.family });
          }}
          className="w-full appearance-none rounded-[13px] border border-white/10 bg-white/5 px-12 py-10 text-12 text-white outline-none focus:border-white/25"
        >
          {fontOptions.map((option) => (
            <option key={option.id} value={option.id} style={{ fontFamily: option.family }} className="bg-[#161616]">
              {option.name}
            </option>
          ))}
          <option value="__add__" className="bg-[#161616]">
            ＋ Import font…
          </option>
        </select>
      </label>

      {font && font.weights.length > 1 && (
        <div className="mt-10">
          <span className="text-10 text-white/45">Weight</span>
          <div className="mt-6 flex flex-wrap gap-6">
            {font.weights.map((weight) => (
              <button
                key={weight}
                type="button"
                onClick={() => updateText(layer.id, { fontWeight: weight })}
                className={`min-w-40 rounded-full px-10 py-6 text-10 transition-colors ${
                  layer.fontWeight === weight ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
                }`}
                style={{ fontWeight: weight }}
              >
                {weight}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <span className="text-10 text-white/45">Size</span>
          <span className="text-10 text-white/55">{Math.round(layer.fontSize)}</span>
        </div>
        <input
          type="range"
          min={12}
          max={280}
          step={1}
          value={clamp(layer.fontSize, 12, 280)}
          onChange={(e) => updateText(layer.id, { fontSize: Number(e.target.value) })}
          aria-label="Font size"
          className="mt-6 h-30 w-full accent-white"
        />
      </div>

      <div className="mt-10">
        <span className="text-10 text-white/45">Colour</span>
        <div className="mt-6 flex flex-wrap items-center gap-7">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Text colour ${color}`}
              onClick={() => updateText(layer.id, { color })}
              className={`size-28 rounded-full border transition-transform hover:scale-110 ${
                layer.color === color ? "border-white" : "border-white/15"
              }`}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            value={safeColor(layer.color, "#1c1b18")}
            onChange={(e) => updateText(layer.id, { color: e.target.value })}
            aria-label="Custom text colour"
            className="h-28 w-40 cursor-pointer rounded-full border border-white/15 bg-transparent"
          />
        </div>
      </div>

      <div className="mt-10">
        <span className="text-10 text-white/45">Align</span>
        <div className="mt-6 grid grid-cols-3 gap-6">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => updateText(layer.id, { align })}
              aria-label={`Align ${align}`}
              aria-pressed={layer.align === align}
              className={`rounded-10 py-8 text-10 capitalize transition-colors ${
                layer.align === align ? "bg-white text-black" : "bg-white/7 text-white/70 hover:bg-white/12"
              }`}
            >
              {align}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-10 text-9 text-white/30">
        {lines.length} {lines.length === 1 ? "line" : "lines"} · double-tap text on canvas to type
      </p>
    </section>
  );
}

function ImageProperties({ layer }: { layer: Layer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  if (layer.type === "text") return null;
  // Normalize rotation into [-180, 180) for the slider: handle rotations can
  // be stored as e.g. 350°, and clamping that into the slider's [-180, 180]
  // domain would corrupt the pose on the next touch (−10° ≡ 350°).
  const sliderRotation = (((layer.rotation % 360) + 540) % 360) - 180;
  return (
    <section className="rounded-[15px] border border-white/8 bg-white/[0.02] p-12">
      <p className="text-11 tracking-[-0.02em] text-white/70">{layer.type === "sticker" ? "Sticker" : "Image"}</p>
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <span className="text-10 text-white/45">Opacity</span>
          <span className="text-10 text-white/55">{Math.round(layer.opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={Math.round(layer.opacity * 100)}
          onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) / 100 })}
          aria-label="Opacity"
          className="mt-6 h-30 w-full accent-white"
        />
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-10 text-white/45">Rotation</span>
          <span className="text-10 text-white/55">{Math.round(sliderRotation)}°</span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={sliderRotation}
          onChange={(e) => updateLayer(layer.id, { rotation: Number(e.target.value) })}
          aria-label="Rotation"
          className="mt-6 h-30 w-full accent-white"
        />
      </div>
    </section>
  );
}

function LayersSection() {
  const layers = useEditorStore((s) => s.document.layers);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);

  // Top of the list = topmost layer.
  const ordered = [...layers].reverse();

  return (
    <section className="rounded-[15px] border border-white/8 bg-white/[0.02] p-12">
      <p className="text-11 tracking-[-0.02em] text-white/70">Layers</p>
      {ordered.length === 0 ? (
        <p className="py-16 text-center text-11 text-white/35">Layers you add will appear here.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {ordered.map((layer) => (
            <li key={layer.id}>
              <div
                className={`flex items-center gap-8 rounded-12 border p-6 transition-colors ${
                  selection === layer.id ? "border-white/45 bg-white/10" : "border-transparent bg-white/[0.04]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => select(layer.id)}
                  className="flex min-w-0 flex-1 items-center gap-10 text-left"
                  aria-label={`Select layer ${layerDisplayName(layer)}`}
                >
                  <span className="flex size-30 shrink-0 items-center justify-center overflow-hidden rounded-8 bg-white/8">
                    {layer.type === "text" ? (
                      <span className="text-13" style={{ fontFamily: layer.fontFamily }}>
                        T
                      </span>
                    ) : (
                      <img
                        src={
                          layer.url && /^(https?:|data:|blob:)/.test(layer.url)
                            ? layer.url
                            : assetUrl(layer.assetId) ?? ""
                        }
                        alt=""
                        className="size-full object-contain p-2"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-11 text-white/80">{layerDisplayName(layer)}</span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <LayerIconBtn
                    label={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={() => useEditorStore.getState().updateLayer(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? <IconEye /> : <IconEyeOff />}
                  </LayerIconBtn>
                  <LayerIconBtn
                    label={layer.locked ? "Unlock layer" : "Lock layer"}
                    onClick={() => useEditorStore.getState().updateLayer(layer.id, { locked: !layer.locked })}
                  >
                    {layer.locked ? <IconLock /> : <IconUnlock />}
                  </LayerIconBtn>
                  <LayerIconBtn
                    label="Move layer up"
                    disabled={layers[layers.length - 1]?.id === layer.id}
                    onClick={() => useEditorStore.getState().reorderLayer(layer.id, 1)}
                  >
                    <IconUp />
                  </LayerIconBtn>
                  <LayerIconBtn
                    label="Move layer down"
                    disabled={layers[0]?.id === layer.id}
                    onClick={() => useEditorStore.getState().reorderLayer(layer.id, -1)}
                  >
                    <IconDown />
                  </LayerIconBtn>
                  <LayerIconBtn
                    label="Delete layer"
                    danger
                    onClick={() => useEditorStore.getState().deleteLayer(layer.id)}
                  >
                    <DelIcon />
                  </LayerIconBtn>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function layerDisplayName(layer: Layer): string {
  if (layer.type === "text") {
    const snippet = layer.text.split("\n")[0].trim();
    return snippet ? snippet.slice(0, 24) : "Text";
  }
  return getAsset(layer.assetId)?.name ?? (layer.type === "sticker" ? "Sticker" : "Image");
}

function LayerIconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-30 items-center justify-center rounded-9 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-25 ${
        danger ? "hover:!bg-[#e5484d]/25 hover:!text-[#ff8f93]" : ""
      }`}
    >
      {children}
    </button>
  );
}
