"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Publish Template dialog (admin).

   "Publish to All Users" opens this dialog instead of publishing
   immediately. The admin reviews the EXACT template preview — rendered by
   the same pipeline as PNG/JPG export (renderDocumentToCanvas), so ratio,
   background, text, fonts, images, crops, rotations, opacity and layer
   order all match the document — fills in metadata, optionally uploads a
   custom preview (presentation only — the Smart Edit document is never
   touched), and only the final Publish action uploads anything:

     local assets  ──once──▶ Cloudinary paper-stish/templates/<project>/
                       └─ fallback: self-contained data urls (no Cloudinary)
     selected preview ──once──▶ Cloudinary / data url
     POST /api/templates  ──▶  metadata + document + asset references

   Merely opening/closing the dialog uploads nothing. A failed publish
   never creates a half-published template and can be retried safely —
   uploads that already succeeded are cached for the retry.
─────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/admin";
import { type AssetRecord, type SmartEditDocument, isImageLike } from "./types";
import {
  assetBlob,
  assetDataUrl,
  blobToDataUrl,
  cloudinaryConfig,
  preparePreviewImage,
  resolvePublicPath,
  snapshotDocumentAssets,
  uploadToCloudinary,
  type CloudinaryUpload,
} from "./assets";
import { useEditorStore } from "./store";
import { renderDocumentToCanvas } from "./exportRenderer";
import { ModalShell, SheetShell } from "./editor-ui";

const DESCRIPTION_MAX_CHARS = 500;
const TITLE_MAX_CHARS = 120;
/** Preview render target — the exact document at a thumbnail-sane size. */
const PREVIEW_MAX_EDGE = 1350;

interface Props {
  projectId: string;
  onClose: () => void;
  onPublished: () => void;
}

/** Render the document through the shared export pipeline → preview blob. */
async function generatePreviewBlob(document: SmartEditDocument): Promise<Blob> {
  const maxEdge = Math.max(document.canvas.width, document.canvas.height);
  const scale = Math.min(1, PREVIEW_MAX_EDGE / maxEdge);
  const canvas = await renderDocumentToCanvas(document, { format: "jpg", scale });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Could not render the preview.");
  return blob;
}

export function PublishTemplateDialog({ projectId, onClose, onPublished }: Props) {
  const { data: session } = useSession();
  const storeTitle = useEditorStore((s) => s.title);

  const [titleValue, setTitleValue] = useState(storeTitle);
  const [description, setDescription] = useState("");
  const [autoPreview, setAutoPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [customPreview, setCustomPreview] = useState<{
    url: string;
    blob: Blob;
    name: string;
  } | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  /** asset id → uploaded Cloudinary reference (survives failed publishes) */
  const assetUploads = useRef(new Map<string, CloudinaryUpload>());
  const previewUploads = useRef(new Map<string, { url: string; publicId: string | null }>());
  const previewJob = useRef<Promise<Blob> | null>(null);
  const previewSeq = useRef(0);
  const objectUrls = useRef(new Set<string>());

  const trackUrl = useCallback((url: string) => {
    objectUrls.current.add(url);
    return url;
  }, []);
  const releaseUrl = useCallback((url: string) => {
    objectUrls.current.delete(url);
    URL.revokeObjectURL(url);
  }, []);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  /* ── Exact automatic preview ─────────────────────────────────────── */

  const startPreviewJob = useCallback(() => {
    const seq = ++previewSeq.current;
    const job = generatePreviewBlob(useEditorStore.getState().document);
    previewJob.current = job;
    setGenerating(true);
    setPreviewError("");
    job
      .then((blob) => {
        if (seq !== previewSeq.current) return; // a newer render superseded this one
        const url = trackUrl(URL.createObjectURL(blob));
        setAutoPreview((prev) => {
          if (prev) releaseUrl(prev.url);
          return { url, blob };
        });
        setGenerating(false);
      })
      .catch(() => {
        if (seq !== previewSeq.current) return;
        setPreviewError("Could not render the preview. Try publishing anyway or reopen this dialog.");
        setGenerating(false);
      });
  }, [releaseUrl, trackUrl]);

  useEffect(() => {
    startPreviewJob();
    // The dialog is modal, but the document can still change underneath it
    // (header Undo/Redo stays reachable, like every sheet in the editor) —
    // the preview follows, debounced, so it always matches what publishes.
    let timer: number | null = null;
    let lastDoc = useEditorStore.getState().document;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.document === lastDoc) return;
      lastDoc = state.document;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(startPreviewJob, 700);
    });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [startPreviewJob]);

  /** The auto preview blob for publishing — regenerates if not ready yet. */
  const ensureAutoPreviewBlob = useCallback(async (): Promise<Blob> => {
    if (autoPreview) return autoPreview.blob;
    const job = generatePreviewBlob(useEditorStore.getState().document);
    previewJob.current = job;
    return job;
  }, [autoPreview]);

  /* ── Optional custom preview (presentation only) ─────────────────── */

  const onPickCustomFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploadError("");
      try {
        const { blob } = await preparePreviewImage(file);
        const url = trackUrl(URL.createObjectURL(blob));
        setCustomPreview((prev) => {
          if (prev) releaseUrl(prev.url);
          return { url, blob, name: file.name };
        });
        setUseCustom(true);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Could not read that image.");
      }
    },
    [releaseUrl, trackUrl],
  );

  const removeCustomPreview = useCallback(() => {
    setCustomPreview((prev) => {
      if (prev) releaseUrl(prev.url);
      return null;
    });
    setUseCustom(false);
    setUploadError("");
  }, [releaseUrl]);

  /* ── Publish (upload once → POST once) ───────────────────────────── */

  const templateFolder = `paper-stish/templates/${projectId}`;

  /** Upload a LOCAL template asset to Cloudinary once per dialog session;
   *  returns null when Cloudinary is not configured (data-url fallback). */
  const uploadAssetOnce = useCallback(
    async (record: AssetRecord): Promise<CloudinaryUpload | null> => {
      const cloud = cloudinaryConfig();
      if (!cloud) return null;
      const cached = assetUploads.current.get(record.id);
      if (cached) return cached;
      const blob = await assetBlob(record.id);
      if (!blob) return null;
      const remote = await uploadToCloudinary(blob, cloud, templateFolder);
      assetUploads.current.set(record.id, remote);
      return remote;
    },
    [templateFolder],
  );

  /** Upload the selected preview once; without Cloudinary the exact render
   *  is stored as a self-contained data url so the template still has one. */
  const uploadPreviewOnce = useCallback(
    async (blob: Blob, key: string): Promise<{ url: string; publicId: string | null }> => {
      const cached = previewUploads.current.get(key);
      if (cached) return cached;
      const cloud = cloudinaryConfig();
      if (cloud) {
        const remote = await uploadToCloudinary(blob, cloud, templateFolder);
        const result = { url: remote.url, publicId: remote.publicId };
        previewUploads.current.set(key, result);
        return result;
      }
      return { url: await blobToDataUrl(blob), publicId: null };
    },
    [templateFolder],
  );

  const publish = useCallback(async () => {
    if (publishing) return;
    if (!isAdminEmail(session?.user?.email)) {
      setPublishError("Only the Paper Stish administrator can publish templates.");
      return;
    }
    const templateTitle = titleValue.trim();
    if (!templateTitle) {
      setPublishError("Give the template a name before publishing.");
      return;
    }

    setPublishing(true);
    setPublishError("");
    try {
      // 1. The selected preview: exact render, or the admin's custom image.
      const previewBlob =
        useCustom && customPreview
          ? customPreview.blob
          : await ensureAutoPreviewBlob();

      const state = useEditorStore.getState();
      if (templateTitle !== state.title) state.setTitle(templateTitle);

      const document = structuredClone(state.document);
      const assets = snapshotDocumentAssets(document);

      // 2. Template assets become durable references. Already-hosted
      //    Cloudinary assets and bundled library items are reused as-is —
      //    never re-uploaded. Local assets upload ONCE (cached per dialog
      //    session); without Cloudinary they embed as data urls, as before.
      for (const layer of document.layers) {
        if (!isImageLike(layer)) continue;
        const record = assets[layer.assetId];
        if (!record) continue;

        if (record.provider !== "local" && record.url) {
          layer.url = resolvePublicPath(record.url);
          continue;
        }

        const uploaded = await uploadAssetOnce(record);
        const url = uploaded ? uploaded.url : ((await assetDataUrl(record.id)) ?? "");
        if (!url) throw new Error(`The asset "${record.name}" is not available for publishing.`);
        layer.url = url;
        assets[record.id] = uploaded
          ? {
              ...record,
              provider: "cloudinary",
              url: uploaded.url,
              width: uploaded.width || record.width,
              height: uploaded.height || record.height,
              ...(uploaded.publicId ? { publicId: uploaded.publicId } : {}),
              storeKey: undefined,
            }
          : { ...record, provider: "bundled", url, storeKey: undefined };
      }

      // 3. User fonts stay self-contained data urls in the document.
      for (const font of document.fonts ?? []) {
        if (font.source !== "user") continue;
        const record = assets[font.id];
        if (!record) continue;
        const dataUrl =
          font.dataUrl ||
          (record.provider === "local" ? await assetDataUrl(record.id) : record.url);
        if (!dataUrl) throw new Error(`The font "${record.name}" is not available for publishing.`);
        font.dataUrl = dataUrl;
        assets[record.id] = { ...record, provider: "bundled", url: dataUrl, storeKey: undefined };
      }

      // 4. Upload the selected preview ONCE → durable reference.
      const preview = await uploadPreviewOnce(
        previewBlob,
        `${useCustom && customPreview ? "custom" : "auto"}:${previewBlob.size}`,
      );

      // 5. Publish — only now is anything created server-side.
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: templateTitle,
          description: description.trim().slice(0, DESCRIPTION_MAX_CHARS),
          document,
          assets,
          previewUrl: preview.url,
          ...(preview.publicId ? { previewPublicId: preview.publicId } : {}),
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

      onPublished();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Could not publish the template.");
    } finally {
      setPublishing(false);
    }
  }, [
    customPreview,
    description,
    ensureAutoPreviewBlob,
    onPublished,
    publishing,
    session?.user?.email,
    titleValue,
    uploadAssetOnce,
    uploadPreviewOnce,
    useCustom,
  ]);

  /* ── Render ──────────────────────────────────────────────────────── */

  const guardedClose = useCallback(() => {
    if (!publishing) onClose();
  }, [onClose, publishing]);

  const displayUrl = useCustom && customPreview ? customPreview.url : autoPreview?.url;

  const body = (
    <div className="grid gap-14">
      <label className="grid gap-7">
        <span className="text-10 text-white/45">Template title</span>
        <input
          value={titleValue}
          onChange={(event) => setTitleValue(event.target.value.slice(0, TITLE_MAX_CHARS))}
          maxLength={TITLE_MAX_CHARS}
          aria-label="Template title"
          className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-10 text-13 text-white outline-none focus:border-white/30"
        />
      </label>

      <label className="grid gap-7">
        <span className="text-10 text-white/45">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX_CHARS))}
          maxLength={DESCRIPTION_MAX_CHARS}
          rows={4}
          spellCheck={false}
          aria-label="Template description"
          className="min-h-90 w-full resize-y rounded-[13px] border border-white/10 bg-white/5 px-12 py-10 text-13 leading-18 text-white outline-none focus:border-white/30"
        />
        <span className="text-9 text-white/30">
          {description.length}/{DESCRIPTION_MAX_CHARS} · shown on the template page
        </span>
      </label>

      <div>
        <span className="text-10 text-white/45">Preview</span>
        <div className="mt-7 flex min-h-140 items-center justify-center overflow-hidden rounded-[13px] border border-white/10 bg-[#0d0d0d] p-10">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Template preview"
              className="max-h-[min(320px,42vh)] w-auto max-w-full rounded-6 object-contain"
            />
          ) : generating ? (
            <div
              className="size-40 rounded-full border-2 border-white/12"
              style={{
                borderTopColor: "rgba(255,255,255,0.55)",
                animation: "se-publish-spin 0.9s linear infinite",
              }}
              role="status"
              aria-label="Rendering template preview"
            />
          ) : (
            <p className="px-12 py-20 text-center text-11 leading-15 text-[#ff8f93]">{previewError}</p>
          )}
        </div>
        {displayUrl && generating && (
          <p className="mt-6 text-9 text-white/35">Updating preview…</p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap gap-8">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={publishing}
            className="rounded-full border border-white/12 bg-white/5 px-14 py-10 text-11 text-white transition-colors hover:bg-white/12 disabled:opacity-40"
          >
            {customPreview ? "Replace custom preview" : "Upload custom preview"}
          </button>
          {customPreview && (
            <button
              type="button"
              onClick={removeCustomPreview}
              disabled={publishing}
              className="rounded-full border border-white/12 bg-white/5 px-14 py-10 text-11 text-white/70 transition-colors hover:bg-white/12 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
        {uploadError && <p className="mt-7 text-11 leading-15 text-[#ff8f93]">{uploadError}</p>}

        <p className="mb-7 mt-12 text-10 text-white/45">Preview source</p>
        <div className="grid grid-cols-2 gap-8">
          <button
            type="button"
            onClick={() => setUseCustom(false)}
            aria-pressed={!useCustom}
            className={`rounded-13 border py-11 transition-colors ${
              !useCustom
                ? "border-white/60 bg-white/10"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/8"
            }`}
          >
            <span className="block text-12">Automatic Preview</span>
            <span className="mt-3 block text-9 text-white/40">Exact Smart Edit render</span>
          </button>
          <button
            type="button"
            onClick={() => (customPreview ? setUseCustom(true) : fileRef.current?.click())}
            aria-pressed={useCustom}
            className={`rounded-13 border py-11 transition-colors ${
              useCustom && customPreview
                ? "border-white/60 bg-white/10"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/8"
            }`}
          >
            <span className="block text-12">Custom Preview</span>
            <span className="mt-3 block text-9 text-white/40">
              {customPreview ? customPreview.name.slice(0, 24) : "None uploaded"}
            </span>
          </button>
        </div>
      </div>

      {publishError && (
        <p className="rounded-10 border border-[#e5484d]/35 bg-[#241214]/95 px-12 py-10 text-11 leading-15 text-[#ff8f93]">
          {publishError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-8">
        <button
          type="button"
          onClick={guardedClose}
          disabled={publishing}
          className="h-46 rounded-full border border-white/12 bg-white/5 text-12 text-white transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={publishing}
          className="h-46 rounded-full bg-white text-12 text-black transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45 disabled:hover:scale-100"
        >
          {publishing ? "Publishing…" : "Publish"}
        </button>
      </div>

      <p className="text-9 leading-13 text-white/30">
        Assets and the preview upload once, when you press Publish. Users who duplicate this template
        reuse the same stored files.
      </p>
    </div>
  );

  return (
    <>
      <div className="hidden s:block">
        <ModalShell
          title="Publish Template"
          subtitle="Review the preview, add a description, then publish to every Paper Stish user."
          onClose={guardedClose}
          width={540}
        >
          {body}
        </ModalShell>
      </div>
      <div className="s:hidden">
        <SheetShell title="Publish Template" onClose={guardedClose}>
          {body}
        </SheetShell>
      </div>

      {/* single hidden file input shared by both layouts */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void onPickCustomFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <style>{`@keyframes se-publish-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
