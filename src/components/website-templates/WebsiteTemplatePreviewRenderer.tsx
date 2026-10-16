"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BirthdayTodayTemplate } from "./BirthdayTodayTemplate";
import { LoveOfMyLifeTemplate } from "./LoveOfMyLifeTemplate";
import { OurCalendarTemplate } from "./OurCalendarTemplate";
import { PhotoAlbumTemplate } from "./PhotoAlbumTemplate";

export type WebsiteTemplatePreviewSlug =
  | "love-heart"
  | "forever-and-ever"
  | "our-calendar"
  | "birthday-today"
  | "love-of-my-life"
  | "birthday-template"
  | "photo-album";

/**
 * Renders the real, non-editing template component for thumbnail capture.
 * This intentionally contains no hand-drawn preview artwork: the capture
 * route displays the same React/template source used by published websites.
 */
export function WebsiteTemplatePreviewRenderer({
  slug,
}: {
  slug: WebsiteTemplatePreviewSlug;
}) {
  const [previewReady, setPreviewReady] = useState(false);
  const [embeddedTemplateLoaded, setEmbeddedTemplateLoaded] = useState(false);
  const usesStaticHtml = slug === "love-heart" || slug === "forever-and-ever";

  useEffect(() => {
    let cancelled = false;

    // The legacy animated templates are already stored as original HTML.
    // Their screenshot should load that exact document directly, avoiding the
    // editor's srcDoc bridge and its intentionally blank loading fallback.
    if (usesStaticHtml && !embeddedTemplateLoaded) {
      return () => {
        cancelled = true;
      };
    }

    const waitForImages = async () => {
      const images = Array.from(document.images);
      images.forEach((image) => { image.loading = "eager"; });
      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
            window.setTimeout(resolve, 12_000);
          });
        }
        if (image.currentSrc && image.complete && image.naturalWidth === 0) {
          throw new Error(`Preview image failed to load: ${image.currentSrc}`);
        }
        if (image.naturalWidth > 0 && typeof image.decode === "function") {
          await image.decode();
        }
      }));
    };

    const finalize = async () => {
      await Promise.race([
        document.fonts?.ready ?? Promise.resolve(),
        new Promise((resolve) => window.setTimeout(resolve, 5000)),
      ]);
      await waitForImages();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (!cancelled) setPreviewReady(true);
    };

    void finalize().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      document.documentElement.dataset.templatePreviewError = message;
      console.error(message);
    });

    return () => {
      cancelled = true;
    };
  }, [slug, embeddedTemplateLoaded]);

  let template: ReactNode;
  switch (slug) {
    case "love-heart":
      template = (
        <iframe
          title="Love Heart website preview"
          src="/website-templates/love-heart.html"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          onLoad={() => setEmbeddedTemplateLoaded(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      );
      break;
    case "forever-and-ever":
      template = (
        <iframe
          title="I love you forever and ever, my baby! website preview"
          src="/website-templates/forever-and-ever.html"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          onLoad={() => setEmbeddedTemplateLoaded(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      );
      break;
    case "our-calendar":
      template = <OurCalendarTemplate />;
      break;
    case "birthday-today":
      template = <BirthdayTodayTemplate />;
      break;
    case "love-of-my-life":
      template = <LoveOfMyLifeTemplate title="To the love of my life" variant="love" />;
      break;
    case "birthday-template":
      template = <LoveOfMyLifeTemplate title="Happy Birthday, my favorite person" variant="birthday" />;
      break;
    case "photo-album":
      template = <PhotoAlbumTemplate title="A little album of us" />;
      break;
  }

  return (
    <div
      data-template-preview-ready={previewReady ? "true" : undefined}
      data-template-preview-slug={slug}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <style>{`
        html, body {
          width: 100%;
          height: 100%;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        body { min-width: 0 !important; }
      `}</style>
      {template}
    </div>
  );
}
