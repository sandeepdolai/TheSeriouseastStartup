"use client";

import { useEffect, useRef, useState } from "react";
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
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
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

    setPublishing(true);
    setError("");
    setCopyError("");
    setCopied(false);

    try {
      const current = useEditorStore.getState();
      const document: SmartEditDocument = structuredClone(current.document);
      const assets: Record<string, AssetRecord> = snapshotDocumentAssets(current.document);
      const cloud = cloudinaryConfig();
      const folder = "paper-stish/published-websites/" +
        projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

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
              uploaded = await uploadToCloudinary(blob, cloud, folder);
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
    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
    } catch {
      setCopyError("Copy was blocked by your browser. Select the link above and copy it manually.");
    }
  };

  const body = published ? (
    <div className="grid gap-14">
      <p className="text-13 leading-19 text-white/65">
        Your website is live. Anyone with the link can open it without signing in.
      </p>
      <label className="grid gap-7">
        <span className="text-10 text-white/45">Your public website link</span>
        <input
          readOnly
          value={published.url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Published website link"
          className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-11 text-12 text-white outline-none focus:border-white/30"
        />
      </label>
      {localSaveWarning && (
        <p className="text-11 leading-16 text-[#f1c27a]">
          The website was published, but its link could not be saved with this local project. Copy the link now.
        </p>
      )}
      {copyError && <p className="text-11 leading-15 text-[#ff8f93]">{copyError}</p>}
      <div className="grid grid-cols-2 gap-8">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="h-44 rounded-full bg-white text-12 text-black transition-opacity hover:opacity-85"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={published.url}
          target="_blank"
          rel="noreferrer"
          className="flex h-44 items-center justify-center rounded-full border border-white/12 bg-white/5 text-12 text-white transition-colors hover:bg-white/10"
        >
          Open website
        </a>
      </div>
      <button
        type="button"
        onClick={guardedClose}
        className="h-44 rounded-full border border-white/12 bg-white/5 text-12 text-white transition-colors hover:bg-white/10"
      >
        Done
      </button>
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

  return (
    <>
      <div className="hidden s:block">
        <ModalShell
          title={published ? "Website published" : "Publish Website"}
          subtitle={published ? "Share the finished website." : title || "Smart Edit"}
          onClose={guardedClose}
          width={540}
        >
          {body}
        </ModalShell>
      </div>
      <div className="s:hidden">
        <SheetShell
          title={published ? "Website published" : "Publish Website"}
          onClose={guardedClose}
        >
          {body}
        </SheetShell>
      </div>
    </>
  );
}
