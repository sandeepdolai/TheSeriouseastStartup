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
import { LoveHeartTemplate } from "@/components/website-templates/LoveHeartTemplate";
import { IntroducingHimTemplate } from "@/components/website-templates/IntroducingHimTemplate";
import { ForeverAndEverTemplate } from "@/components/website-templates/ForeverAndEverTemplate";
import { OurCalendarTemplate } from "@/components/website-templates/OurCalendarTemplate";
import { BirthdayTodayTemplate } from "@/components/website-templates/BirthdayTodayTemplate";
import { RedLetterTemplate } from "@/components/website-templates/RedLetterTemplate";
import { RoseTemplate } from "@/components/website-templates/RoseTemplate";
import { MemoryLaneTemplate } from "@/components/website-templates/MemoryLaneTemplate";

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

    const syncRoutePublication = () => {
      // The route can change without a full document reload (for example,
      // opening a republished link in an already-mounted viewer). Never keep
      // the previous link's text or photos when the server payload changes.
      const nextPublication = initialPublication
        ? validatePublishedPayload(initialPublication)
        : null;
      setSmartEdit(null);
      setServerPublication(nextPublication);
      setPhase(nextPublication ? "ready" : "missing");
    };

    const readFragment = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const value = hash.startsWith("data=") ? hash.slice(5) : "";
      if (!value) {
        syncRoutePublication();
        return;
      }

      // Legacy #data= links still decode client-side after hydration.
      const smart = decodeSmartEditPayload(value);
      setSmartEdit(smart);
      setServerPublication(null);
      setPhase("ready");
    };

    readFragment();
    window.addEventListener("hashchange", readFragment);
    return () => {
      window.removeEventListener("hashchange", readFragment);
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
    // Remount the selected renderer when the published snapshot changes.
    // This is especially important for templates that initialize a document
    // or animation in an iframe and must receive a fresh initial snapshot.
    const publicationKey = `${templateId}:${serverPublication.templateSlug}:${serverPublication.publishedAt}`;

    if (serverPublication.templateSlug === "memory-lane" && serverPublication.values) {
      return <MemoryLaneTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "red-letter" && serverPublication.values) {
      return <RedLetterTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "introducing-him" && serverPublication.values) {
      return <IntroducingHimTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "love-heart" && serverPublication.values) {
      return <LoveHeartTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (["rose", "rose-blush", "rose-noir"].includes(serverPublication.templateSlug) && serverPublication.values) {
      // Keep older published links working, but render them with the one
      // canonical Rose design instead of retaining the removed variants.
      return <RoseTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "forever-and-ever" && serverPublication.values) {
      return <ForeverAndEverTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "our-calendar" && serverPublication.values) {
      return <OurCalendarTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "birthday-today" && serverPublication.values) {
      return <BirthdayTodayTemplate key={publicationKey} values={serverPublication.values} />;
    }

    if (serverPublication.templateSlug === "smart-edit" && serverPublication.document) {
      return (
        <SmartEditViewer key={publicationKey}
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
          key={publicationKey}
          title={serverPublication.title}
          values={serverPublication.values}
          variant={serverPublication.templateSlug === "birthday-template" ? "birthday" : "love"}
        />
      );
    }

    if (serverPublication.templateSlug === "photo-album" && serverPublication.values) {
      return <PhotoAlbumTemplate key={publicationKey} title={serverPublication.title} values={serverPublication.values} />;
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
