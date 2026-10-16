"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { putLocalProject } from "@/lib/localProjects";
import {
  publishResultToRecord,
  publishWebsite,
  slugPart,
  type PublishedRecord,
} from "@/lib/publications";
import {
  assetBlob,
  assetDataUrl,
  blobToDataUrl,
  cloudinaryConfig,
  registerAsset,
  resolvePublicPath,
  snapshotDocumentAssets,
  uploadToCloudinary,
  type CloudinaryUpload,
} from "./assets";
import { isImageLike, type AssetRecord, type SmartEditDocument } from "./types";
import { useEditorStore } from "./store";
import { ModalShell, SheetShell } from "./editor-ui";

interface Props {
  projectId: string;
  account: string;
  previousPublished: PublishedRecord | null;
  onClose: () => void;
  onPublished: (record: PublishedRecord) => void;
  onUnpublished: () => void;
}

function PublishSuccessSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 top-[calc(var(--se-header-h,7.2rem)+env(safe-area-inset-top))] s:top-0 z-[90] flex items-end s:items-center justify-center bg-black/60 px-0 s:px-15 backdrop-blur-[6px]"
      style={{ bottom: "var(--se-kb, 0px)" }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-success-title"
        className="flex max-h-[calc(100%-14px)] w-full flex-col overflow-hidden rounded-t-[32px] border-t border-white/10 bg-[#303030] text-white shadow-[0_-20px_60px_rgba(0,0,0,0.5)] s:max-h-[86svh] s:max-w-[540px] s:rounded-[28px] s:border s:border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex shrink-0 justify-center pb-[2px] pt-[18px] s:hidden" aria-hidden="true">
          <span className="h-[4px] w-[72px] rounded-full bg-white/75" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[22px] pb-[24px] pt-[28px] s:px-[30px] s:pb-[28px] s:pt-[28px]">
          {children}
        </div>
      </div>
    </div>
  );
}

async function dataUrlForAsset(id: string): Promise<string | undefined> {
  const existing = await assetDataUrl(id);
  if (existing) return existing;
  const blob = await assetBlob(id);
  return blob ? blobToDataUrl(blob) : undefined;
}

export function SmartEditPublishWebsiteDialog({
  projectId,
  account,
  previousPublished,
  onClose,
  onPublished,
  onUnpublished,
}: Props) {
  const title = useEditorStore((state) => state.title);
  const [username, setUsername] = useState(previousPublished?.username ?? "");
  const [viewerName, setViewerName] = useState(previousPublished?.viewerName ?? "");
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedRecord | null>(null);
  const [publicationMode, setPublicationMode] = useState<"new" | "update">("new");
  const [copyError, setCopyError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [localSaveWarning, setLocalSaveWarning] = useState(false);
  const uploads = useRef(new Map<string, CloudinaryUpload>());

  useEffect(() => {
    if (previousPublished?.username) return;
    try {
      const remembered = window.localStorage.getItem("paper-stish-publish-username");
      if (remembered) setUsername((current) => current || remembered);
    } catch {
      // Remembered username is an optional convenience.
    }
  }, [previousPublished?.username]);

  const publish = async () => {
    if (publishing) return;

    const safeUsername = slugPart(username, "");
    const safeViewerName = slugPart(viewerName, "");
    if (!safeUsername || !safeViewerName) {
      setError("Enter both a public username and a website name. Letters and numbers work best.");
      return;
    }

    setPublicationMode(previousPublished?.templateId ? "update" : "new");
    setPublishing(true);
    setError("");
    setCopyError("");
    setShareNotice("");
    setCopied(false);
    setShowQrCode(false);
    setQrError("");

    try {
      const current = useEditorStore.getState();
      const document: SmartEditDocument = structuredClone(current.document);
      const assets: Record<string, AssetRecord> = snapshotDocumentAssets(current.document);
      const cloud = cloudinaryConfig();

      // Every image must use a durable URL. Device-local blob URLs cannot
      // work for visitors who open the published site on another device.
      for (const layer of document.layers) {
        if (!isImageLike(layer)) continue;
        const record = assets[layer.assetId];
        if (!record) {
          throw new Error("An image in this design is no longer available. Re-add it and try again.");
        }

        if (record.provider !== "local" && record.url) {
          layer.url = resolvePublicPath(record.url);
          continue;
        }

        let durableUrl: string | undefined;
        let uploaded: CloudinaryUpload | undefined;
        if (cloud) {
          uploaded = uploads.current.get(record.id);
          if (!uploaded) {
            const blob = await assetBlob(record.id);
            if (blob) {
              // Server-authorized upload: the server signs user/site-scoped
              // Cloudinary parameters after checking the session + quotas.
              uploaded = await uploadToCloudinary(blob, "smart-edit", projectId);
              uploads.current.set(record.id, uploaded);
            }
          }
        }

        if (uploaded) {
          durableUrl = uploaded.url;
          assets[record.id] = {
            ...record,
            provider: "cloudinary",
            url: uploaded.url,
            width: uploaded.width || record.width,
            height: uploaded.height || record.height,
            ...(uploaded.publicId ? { publicId: uploaded.publicId } : {}),
            storeKey: undefined,
          };
        } else if (cloud) {
          // Cloudinary deployments must publish durable URLs only — the
          // server rejects embedded base64 images, so fail with a clear
          // message instead of producing a snapshot that cannot publish.
          throw new Error(
            `The image "${record.name}" could not be uploaded for publishing. Check your connection and try again.`,
          );
        } else {
          durableUrl = await dataUrlForAsset(record.id);
          if (durableUrl) {
            assets[record.id] = {
              ...record,
              provider: "bundled",
              url: durableUrl,
              storeKey: undefined,
            };
          }
        }

        if (!durableUrl) {
          throw new Error("The image \"" + record.name + "\" is unavailable. Re-add it and try again.");
        }
        layer.url = durableUrl;
      }

      // Imported fonts are embedded in the published snapshot. This keeps
      // visitors independent of the author's IndexedDB and installed fonts.
      for (const font of document.fonts ?? []) {
        if (font.source !== "user") continue;
        const record = assets[font.id];
        const dataUrl =
          font.dataUrl ||
          (record?.provider === "local"
            ? await dataUrlForAsset(font.id)
            : record?.url);
        if (!dataUrl) {
          throw new Error("The font used in this design is unavailable. Re-add it and try again.");
        }
        font.dataUrl = dataUrl;
        if (record) {
          assets[font.id] = {
            ...record,
            provider: "bundled",
            url: dataUrl,
            storeKey: undefined,
          };
        }
      }

      const result = await publishWebsite({
        templateSlug: "smart-edit",
        title: current.title.trim().slice(0, 120) || "Smart Edit",
        username: safeUsername,
        viewerName: safeViewerName,
        ...(previousPublished?.templateId
          ? { previousTemplateId: previousPublished.templateId }
          : {}),
        data: { document },
      });
      const publication = publishResultToRecord(result);

      // Keep the published asset references in the local project so future
      // republishes reuse the same remote assets instead of uploading them
      // again. The live editor document itself is not mutated.
      for (const record of Object.values(assets)) registerAsset(record);
      const savedDocument: SmartEditDocument = structuredClone(current.document);
      const publishedLayerUrls = new Map(
        document.layers
          .filter(isImageLike)
          .map((layer) => [layer.id, layer.url] as const),
      );
      for (const layer of savedDocument.layers) {
        if (!isImageLike(layer)) continue;
        const url = publishedLayerUrls.get(layer.id);
        if (url) layer.url = url;
      }
      for (const font of savedDocument.fonts ?? []) {
        if (font.source !== "user") continue;
        const publishedFont = document.fonts.find((item) => item.id === font.id);
        if (publishedFont?.dataUrl) font.dataUrl = publishedFont.dataUrl;
      }

      let saved = false;
      try {
        saved = await putLocalProject({
          id: projectId,
          account,
          title: current.title,
          templateSlug: "smart-edit",
          updatedAt: new Date().toISOString(),
          data: {
            kind: "smart-edit",
            document: savedDocument,
            assets,
            published: publication,
          },
        });
      } catch {
        saved = false;
      }

      setLocalSaveWarning(!saved);
      setPublished(publication);
      setUsername(publication.username);
      setViewerName(publication.viewerName);
      try {
        window.localStorage.setItem("paper-stish-publish-username", publication.username);
      } catch {
        // Local metadata is optional; the project record remains authoritative.
      }
      onPublished(publication);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish this website. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    if (!previousPublished || publishing || unpublishing) return;
    const confirmed = window.confirm(
      "Unpublish this website? Anyone opening its current link will no longer be able to view it.",
    );
    if (!confirmed) return;

    setUnpublishing(true);
    setError("");
    try {
      const response = await fetch("/api/publish", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: previousPublished.templateId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not unpublish this website. Try again.");
      }

      const saved = await putLocalProject({
        id: projectId,
        account,
        title,
        templateSlug: "smart-edit",
        updatedAt: new Date().toISOString(),
        data: { published: null },
      });
      onUnpublished();
      if (!saved) {
        window.alert("The website is unpublished, but this device could not update its local project record.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unpublish this website. Try again.");
    } finally {
      setUnpublishing(false);
    }
  };

  const guardedClose = () => {
    if (!publishing && !unpublishing) onClose();
  };

  const copyLink = async () => {
    if (!published) return;
    setCopyError("");
    setShareNotice("");
    setCopied(false);
    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
    } catch {
      setCopyError("Copy was blocked by your browser. Select the published link below and copy it manually.");
    }
  };

  const shareLink = async () => {
    if (!published) return;
    setCopyError("");
    setShareNotice("");
    setCopied(false);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: published.viewerName || "My Paper Stish website",
          text: "Send this link to anyone, anywhere.",
          url: published.url,
        });
        return;
      } catch (err) {
        // Dismissing the native share sheet is not an error.
        if (err instanceof Error && err.name === "AbortError") return;
        // Continue to the clipboard fallback when native sharing fails.
      }
    }

    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
      setShareNotice("The share menu isn’t available, so we copied the link instead.");
    } catch {
      setCopyError("Sharing is unavailable here. Select the published link above and copy it manually.");
    }
  };

  const qrCodeUrl = published
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&margin=12&data=${encodeURIComponent(published.url)}`
    : "";

  const downloadQrCode = async () => {
    if (!published || !qrCodeUrl || qrDownloading) return;
    setQrDownloading(true);
    setQrError("");
    try {
      const response = await fetch(qrCodeUrl);
      if (!response.ok) throw new Error("QR code download failed.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${slugPart(published.viewerName, "website")}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setQrError("Your browser could not download the QR image directly. Open the QR image and save it from your browser instead.");
      window.open(qrCodeUrl, "_blank", "noopener,noreferrer");
    } finally {
      setQrDownloading(false);
    }
  };

  const body = published ? (
    <div className="grid gap-0">
      <div className="mx-auto mb-[22px] flex size-[58px] items-center justify-center text-white" aria-hidden="true">
        <svg viewBox="0 0 56 56" className="size-[54px]" fill="none">
          <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="2.2" />
          <path d="m16.5 28.5 7.5 7.5 15.5-17" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2
        id="publish-success-title"
        className="text-center text-[28px] font-semibold leading-[1.16] tracking-[-0.035em] text-white s:text-[30px]"
      >
        {publicationMode === "update" ? "Your website is up to date." : "Your website is live."}
      </h2>
      <p className="mx-auto mt-[16px] max-w-[440px] text-center text-[16px] leading-[1.5] text-white/85 s:text-[17px]">
        {publicationMode === "update"
          ? "Your latest changes are live. Your existing link still works."
          : "Anyone with this link can view it. Your design remains editable."}
      </p>

      <label className="mt-[24px] grid gap-8">
        <span className="text-[12px] font-semibold text-white/75">YOUR WEBSITE LINK</span>
        <input
          readOnly
          value={published.url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Published website link"
          className="h-[50px] w-full min-w-0 rounded-[14px] border border-white/15 bg-black/20 px-12 text-[13px] text-white outline-none focus:border-white/45"
        />
      </label>

      <button
        type="button"
        onClick={() => void copyLink()}
        aria-live="polite"
        className="mt-[12px] flex h-[54px] w-full items-center justify-center rounded-full bg-[#2166f3] px-16 text-[16px] font-semibold text-white transition-colors hover:bg-[#1e5bd8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 24 24" className="mr-10 size-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8.5" y="8.5" width="11" height="12" rx="2" />
          <path d="M15.5 8.5V5.75A1.75 1.75 0 0 0 13.75 4h-8A1.75 1.75 0 0 0 4 5.75v8A1.75 1.75 0 0 0 5.75 15.5H8.5" />
        </svg>
        {copied ? "Copied!" : "Copy link"}
      </button>

      {copyError && (
        <p role="status" className="mt-10 text-[12px] leading-[1.45] text-[#ffaaaa]">
          {copyError}
        </p>
      )}
      {shareNotice && (
        <p role="status" className="mt-10 text-[12px] leading-[1.45] text-white/75">
          {shareNotice}
        </p>
      )}
      {localSaveWarning && (
        <p role="status" className="mt-10 rounded-[12px] border border-[#f1c27a]/25 bg-[#f1c27a]/[0.07] px-12 py-10 text-[12px] leading-[1.45] text-[#f1c27a]">
          Your website is live, but its link could not be saved with this device’s local project. Copy the link now.
        </p>
      )}

      <div className="mt-[12px] grid grid-cols-2 gap-[10px]">
        <button
          type="button"
          onClick={() => void shareLink()}
          className="flex h-[48px] items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-10 text-[14px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="mr-8 size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="2.2" />
            <circle cx="6" cy="12" r="2.2" />
            <circle cx="18" cy="19" r="2.2" />
            <path d="m8 11 7.8-4.7M8 13l7.8 4.7" />
          </svg>
          Share
        </button>
        <a
          href={published.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[48px] items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-10 text-[14px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="mr-8 size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 5h6v6M19 5l-9 9" />
            <path d="M18 13.5v4A1.5 1.5 0 0 1 16.5 19h-11A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5h4" />
          </svg>
          Open website
        </a>
      </div>

      <div className="mt-[24px] border-t border-white/12 pt-[18px] pb-[18px]">
        <div className="flex items-center justify-between gap-12">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-white">QR code</p>
            <p className="mt-5 text-[12px] leading-[1.4] text-white/65">Let someone scan to visit your website.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowQrCode((visible) => !visible);
              setQrError("");
            }}
            aria-expanded={showQrCode}
            className="shrink-0 rounded-full border border-white/20 px-12 py-9 text-[12px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {showQrCode ? "Hide QR code" : "Show QR code"}
          </button>
        </div>
        {showQrCode && (
          <div className="mt-[18px] grid justify-items-center gap-[12px]">
            <div className="rounded-[14px] bg-white p-10">
              <img
                src={qrCodeUrl}
                alt={`QR code for ${published.viewerName}`}
                width={240}
                height={240}
                className="block h-auto w-[240px] max-w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => void downloadQrCode()}
              disabled={qrDownloading}
              className="h-[46px] w-full rounded-full border border-white/20 bg-white/[0.04] text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {qrDownloading ? "Preparing download…" : "Save as PNG"}
            </button>
            {qrError && (
              <p role="status" className="text-[12px] leading-[1.45] text-[#f1c27a]">
                {qrError}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={guardedClose}
        className="mt-[24px] h-[48px] w-full rounded-full border border-white/20 bg-white/[0.04] text-[14px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Back to editing
      </button>
      <p className="mt-10 text-center text-[12px] leading-[1.45] text-white/55">
        Your website stays published when you return to editing.
      </p>
    </div>
  ) : (
    <div className="grid gap-14">
      <p className="text-12 leading-18 text-white/55">
        Publish a finished, public website from this Smart Edit design. Your original project stays editable.
        Visitors do not need an account.
      </p>
      <label className="grid gap-7">
        <span className="text-10 text-white/45">Your public username</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value.slice(0, 60))}
          maxLength={60}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="your-name"
          disabled={publishing}
          aria-label="Your public username"
          className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-11 text-13 text-white outline-none focus:border-white/30 disabled:opacity-50"
        />
      </label>
      <label className="grid gap-7">
        <span className="text-10 text-white/45">Website name</span>
        <input
          value={viewerName}
          onChange={(event) => setViewerName(event.target.value.slice(0, 60))}
          maxLength={60}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="for-someone-special"
          disabled={publishing}
          aria-label="Website name"
          className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-11 text-13 text-white outline-none focus:border-white/30 disabled:opacity-50"
        />
      </label>
      <div className="rounded-[13px] border border-white/8 bg-white/[0.03] px-12 py-11">
        <p className="text-9 text-white/35">Link preview</p>
        <p className="mt-5 break-all text-11 leading-16 text-white/65">
          /{slugPart(username, "your-name")}/{slugPart(viewerName, "website-name")}/[id]
        </p>
      </div>
      {previousPublished && (
        <p className="text-10 leading-15 text-white/40">
          This project already has a published link. Publishing again updates that link instead of creating a new one.
        </p>
      )}
      {error && (
        <p className="rounded-10 border border-[#e5484d]/35 bg-[#241214]/95 px-12 py-10 text-11 leading-15 text-[#ff8f93]">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-8">
        <button
          type="button"
          onClick={guardedClose}
          disabled={publishing || unpublishing}
          className="h-46 rounded-full border border-white/12 bg-white/5 text-12 text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={publishing || unpublishing}
          className="h-46 rounded-full bg-white text-12 text-black transition-opacity hover:opacity-85 disabled:opacity-45"
        >
          {publishing ? "Publishing…" : previousPublished ? "Republish website" : "Publish website"}
        </button>
      </div>
      {previousPublished && (
        <button
          type="button"
          onClick={() => void unpublish()}
          disabled={publishing || unpublishing}
          className="h-42 rounded-full border border-[#e5484d]/30 bg-[#e5484d]/8 text-11 text-[#ffaaa8] transition-colors hover:bg-[#e5484d]/15 disabled:opacity-45"
        >
          {unpublishing ? "Unpublishing…" : "Unpublish website"}
        </button>
      )}
      <p className="text-9 leading-13 text-white/30">
        The public link is created only when you press Publish. Republish keeps the same link.
      </p>
    </div>
  );

  return published ? (
    <PublishSuccessSheet onClose={guardedClose}>{body}</PublishSuccessSheet>
  ) : (
    <>
      <div className="hidden s:block">
        <ModalShell
          title="Publish Website"
          subtitle={title || "Smart Edit"}
          onClose={guardedClose}
          width={540}
        >
          {body}
        </ModalShell>
      </div>
      <div className="s:hidden">
        <SheetShell title="Publish Website" onClose={guardedClose}>
          {body}
        </SheetShell>
      </div>
    </>
  );
}
