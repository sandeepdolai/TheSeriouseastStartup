"use client";

import type { KeyboardEvent } from "react";
import type { TemplatePublicationValues } from "@/lib/publications";
import { InlineEditableText } from "./InlineEditableText";
import styles from "./PhotoAlbumTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const DEFAULT_ALBUM_PHOTOS = [
  BASE_PATH + "/templates/love-of-my-life-art.webp",
  BASE_PATH + "/templates/love-cats.webp",
  BASE_PATH + "/templates/love-favorite-person-art.webp",
  BASE_PATH + "/templates/love-bow.webp",
  BASE_PATH + "/templates/love-of-my-life.webp",
  BASE_PATH + "/templates/love-polaroid-frame.webp",
];

export const DEFAULT_ALBUM_CAPTIONS = [
  "The little things",
  "A day worth keeping",
  "Our kind of ordinary",
  "A favorite memory",
  "Just us",
  "One for the album",
];

type EditableField = "heading" | "message";

interface Props {
  values?: TemplatePublicationValues;
  title?: string;
  editing?: boolean;
  onTextChange?: (field: EditableField, value: string) => void;
  onCaptionChange?: (index: number, value: string) => void;
  onPhotoClick?: (index: number) => void;
  onExit?: () => void;
}

export function PhotoAlbumTemplate({
  values = {},
  title,
  editing = false,
  onTextChange,
  onCaptionChange,
  onPhotoClick,
  onExit,
}: Props) {
  const fallbackHeading = "A little album of us";
  const fallbackMessage =
    "The days go by quickly. These are the moments I want to keep close, one little memory at a time.";
  const heading = editing ? (values.heading ?? fallbackHeading) : values.heading?.trim() || fallbackHeading;
  const message = editing ? (values.message ?? fallbackMessage) : values.message?.trim() || fallbackMessage;
  const uploaded = (values.images ?? []).filter((image) => typeof image === "string" && image.length > 0).slice(0, 6);
  // Keep six designed photo positions visible; changing one photo never removes the others.
  const photos = [...uploaded, ...DEFAULT_ALBUM_PHOTOS.slice(uploaded.length)].slice(0, 6);
  const captions = values.captions ?? [];

  const photoSurfaceProps = (index: number) => ({
    role: editing ? "button" as const : undefined,
    tabIndex: editing ? 0 : undefined,
    "aria-label": editing ? "Replace photo " + (index + 1) : undefined,
    title: editing ? "Tap to replace this photo" : undefined,
    onClick: editing ? () => onPhotoClick?.(index) : undefined,
    onKeyDown: editing
      ? (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPhotoClick?.(index);
          }
        }
      : undefined,
  });

  const captionValue = (index: number) => editing
    ? (captions[index] ?? DEFAULT_ALBUM_CAPTIONS[index] ?? "A favorite moment")
    : captions[index]?.trim() || DEFAULT_ALBUM_CAPTIONS[index] || "A favorite moment";

  return (
    <main className={styles.page}>
      <div className={styles.paper}>
        <header className={styles.header}>
          <a
            className={styles.wordmark}
            href="/"
            aria-label={editing ? "Back to website templates" : "Paper Stish home"}
            onClick={editing && onExit ? (event) => { event.preventDefault(); onExit(); } : undefined}
          >
            little album<span>♡</span>
          </a>
          <p className={styles.headerNote}>A COLLECTION OF LITTLE MOMENTS</p>
        </header>

        <section className={styles.hero}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span aria-hidden="true">✳</span> OUR PHOTO ALBUM</p>
            <InlineEditableText
              as="h1"
              value={heading}
              editing={editing}
              multiline
              ariaLabel="Album heading"
              onCommit={(value) => onTextChange?.("heading", value)}
            />
            <InlineEditableText
              as="p"
              className={styles.message}
              value={message}
              editing={editing}
              multiline
              ariaLabel="Album message"
              onCommit={(value) => onTextChange?.("message", value)}
            />
            <div className={styles.stamp}>
              <span className={styles.stampTop}>KEPT WITH LOVE</span>
              <span className={styles.stampHeart} aria-hidden="true">♡</span>
              <span className={styles.stampBottom}>{String(photos.length).padStart(2, "0")} MEMORIES</span>
            </div>
          </div>
          <figure className={styles.cover}>
            <div className={`${styles.photoMat} ${styles.coverMat} ${editing ? styles.editablePhoto : ""}`} {...photoSurfaceProps(0)}>
              <img src={photos[0]} alt={captionValue(0)} />
            </div>
            <figcaption>
              <InlineEditableText
                value={captionValue(0)}
                editing={editing}
                ariaLabel="Cover photo caption"
                onCommit={(value) => onCaptionChange?.(0, value)}
              />
            </figcaption>
            <span className={styles.tape} aria-hidden="true" />
          </figure>
        </section>

        <section className={styles.album} aria-label="Photo album">
          <div className={styles.albumHeading}>
            <span>01 / THE ALBUM</span>
            <span>{String(photos.length).padStart(2, "0")} PHOTOS</span>
          </div>
          <div className={styles.grid}>
            {photos.map((photo, index) => (
              <figure className={styles.photoCard} key={index}>
                <div className={`${styles.photoMat} ${editing ? styles.editablePhoto : ""}`} {...photoSurfaceProps(index)}>
                  <img
                    src={photo}
                    alt={captionValue(index)}
                    loading={index > 1 ? "lazy" : "eager"}
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span className={styles.photoNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <InlineEditableText
                    value={captionValue(index)}
                    editing={editing}
                    ariaLabel={"Caption for photo " + (index + 1)}
                    onCommit={(value) => onCaptionChange?.(index, value)}
                  />
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>MADE OF MOMENTS, KEPT FOREVER</span>
          <span>{title?.trim() || "Our photo album"} · paper stish ♡</span>
        </footer>
      </div>
    </main>
  );
}
