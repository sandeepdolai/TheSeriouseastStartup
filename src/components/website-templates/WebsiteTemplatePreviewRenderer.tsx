"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BirthdayTodayTemplate } from "./BirthdayTodayTemplate";
import { ForeverAndEverTemplate } from "./ForeverAndEverTemplate";
import { LoveHeartTemplate } from "./LoveHeartTemplate";
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

  useEffect(() => {
    let cancelled = false;

    const waitForTemplateSource = () => new Promise<void>((resolve, reject) => {
      const loadedSelector = '[data-template-preview-source-loaded="true"]';
      const errorSelector = "[data-template-preview-source-error]";
      let settled = false;
      let observer: MutationObserver;
      let timeout = 0;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        observer.disconnect();
        if (error) reject(error);
        else resolve();
      };

      const inspect = () => {
        const failed = document.querySelector<HTMLElement>(errorSelector);
        if (failed) {
          finish(new Error(
            `${slug} source failed to load: ${failed.getAttribute("data-template-preview-source-error") || "unknown error"}`,
          ));
          return;
        }
        if (document.querySelector(loadedSelector)) finish();
      };

      observer = new MutationObserver(inspect);
      timeout = window.setTimeout(() => {
        finish(new Error(`Timed out waiting for the original ${slug} HTML source to load.`));
      }, 45_000);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-template-preview-source-loaded", "data-template-preview-source-error"],
        childList: true,
        subtree: true,
      });
      inspect();
    });

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
      if (slug === "love-heart" || slug === "forever-and-ever") {
        await waitForTemplateSource();
      }
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
  }, [slug]);

  let template: ReactNode;
  switch (slug) {
    case "love-heart":
      template = <LoveHeartTemplate />;
      break;
    case "forever-and-ever":
      template = <ForeverAndEverTemplate />;
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
