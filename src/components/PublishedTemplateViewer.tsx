"use client";

import { useEffect, useState } from "react";
import { type PublishedTemplatePayload } from "@/lib/publish";
import {
  decodeSmartEditPayload,
  type SmartEditPublishedPayload,
} from "@/components/smartedit/publish";
import {
  validatePublishedPayload,
  type PublishedWebsitePayload,
} from "@/lib/publications";
import { SmartEditViewer } from "@/components/smartedit/SmartEditViewer";
import { LoveOfMyLifeTemplate } from "@/components/website-templates/LoveOfMyLifeTemplate";
import { PhotoAlbumTemplate } from "@/components/website-templates/PhotoAlbumTemplate";

interface Props {
  username: string;
  viewerName: string;
  templateId: string;
  /** Server-resolved publication (already validated server-side). */
  initialPublication?: PublishedWebsitePayload | null;
}

type Phase = "loading" | "ready" | "missing";

/**
 * Public viewer for /{username}/{viewerName}/{templateId}.
 *
 * • The publication snapshot is resolved SERVER-SIDE by the route and passed
 *   in — the viewer never reads the author's or the visitor's localStorage,
 *   IndexedDB or any private project state. The validated publication is
 *   part of the first render, so the finished website is in the HTML.
 * • Legacy links carry the document in the #data= fragment — still decoded
 *   client-side after hydration so previously published websites keep
 *   working.
 * • The correct renderer is chosen from the publication's templateSlug.
 */
export function PublishedTemplateViewer({
  username,
  viewerName,
  templateId,
  initialPublication,
}: Props) {
  // Validated once from the server-resolved publication — identical on the
  // server render and the client's first render, so hydration always
  // matches and the content is server-rendered.
  const [serverPublication, setServerPublication] = useState(() =>
    initialPublication ? validatePublishedPayload(initialPublication) : null,
  );
  const [smartEdit, setSmartEdit] = useState<SmartEditPublishedPayload | null>(null);
  const [phase, setPhase] = useState<Phase>(serverPublication ? "ready" : "loading");

  useEffect(() => {
    document.documentElement.classList.add("paper-stish-viewer");

    const readFragment = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const value = hash.startsWith("data=") ? hash.slice(5) : "";
      if (!value) return false;
      // Legacy #data= link — the payload travels in the fragment.
      const smart = decodeSmartEditPayload(value);
      setSmartEdit(smart);
      setServerPublication(null);
      setPhase("ready");
      return true;
    };

    if (readFragment()) {
      window.addEventListener("hashchange", readFragment);
      return () => {
        window.removeEventListener("hashchange", readFragment);
        document.documentElement.classList.remove("paper-stish-viewer");
      };
    }

    // No fragment: the server already resolved the publication — either it
    // is rendered above (phase "ready") or this link does not resolve.
    const finishServerLookup = () => {
      setPhase((current) => (current === "loading" ? "missing" : current));
    };
    finishServerLookup();

    return () => {
      document.documentElement.classList.remove("paper-stish-viewer");
    };
  }, [templateId, username, viewerName, initialPublication]);

  if (phase === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#101010]">
        <div
          className="size-40 rounded-full border-2 border-white/15"
          style={{ borderTopColor: "rgba(255,255,255,0.6)", animation: "ptv-spin 0.9s linear infinite" }}
          role="status"
          aria-label="Loading website"
        />
        <style>{`@keyframes ptv-spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (smartEdit) {
    return <SmartEditViewer initialPayload={smartEdit} />;
  }

  if (serverPublication) {
    if (serverPublication.templateSlug === "smart-edit" && serverPublication.document) {
      return (
        <SmartEditViewer
          initialPayload={{
            version: 1,
            templateSlug: "smart-edit",
            title: serverPublication.title,
            publishedAt: serverPublication.publishedAt,
            document: serverPublication.document,
          }}
        />
      );
    }

    if (
      (serverPublication.templateSlug === "love-of-my-life" ||
        serverPublication.templateSlug === "birthday-template") &&
      serverPublication.values
    ) {
      return (
        <LoveOfMyLifeTemplate
          title={serverPublication.title}
          values={serverPublication.values}
          variant={serverPublication.templateSlug === "birthday-template" ? "birthday" : "love"}
        />
      );
    }

    if (serverPublication.templateSlug === "photo-album" && serverPublication.values) {
      return <PhotoAlbumTemplate title={serverPublication.title} values={serverPublication.values} />;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#efede2] px-20 text-center text-[#073b91]">
      <div>
        <p
          className="text-28"
          style={{ fontFamily: '"Gochi Hand", "Patrick Hand", cursive' }}
        >
          This website link does not exist anymore.
        </p>
        <p className="mt-8 font-sans text-13 text-[#073b91]/55">
          Check the link you received, or ask the sender to publish it again.
        </p>
      </div>
    </main>
  );
}
