"use client";

import type { ReactNode } from "react";
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
      data-template-preview-ready="true"
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
