"use client";

import type { TemplatePublicationValues } from "@/lib/publications";
import styles from "./PhotoAlbumTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DEFAULT_PHOTOS = [
  BASE_PATH + "/templates/love-of-my-life-art.webp",
  BASE_PATH + "/templates/love-cats.webp",
  BASE_PATH + "/templates/love-favorite-person-art.webp",
  BASE_PATH + "/templates/love-bow.webp",
  BASE_PATH + "/templates/love-of-my-life.webp",
  BASE_PATH + "/templates/love-polaroid-frame.webp",
];
const DEFAULT_CAPTIONS = [
  "The little things",
  "A day worth keeping",
  "Our kind of ordinary",
  "A favorite memory",
  "Just us",
  "One for the album",
];

export function PhotoAlbumTemplate({ values = {}, title }: {
  values?: TemplatePublicationValues;
  title?: string;
}) {
  const heading = values.heading?.trim() || "A little album of us";
  const message = values.message?.trim() ||
    "The days go by quickly. These are the moments I want to keep close, one little memory at a time.";
  const uploaded = (values.images ?? []).filter((image) => typeof image === "string" && image.length > 0).slice(0, 6);
  const photos = uploaded.length ? uploaded : DEFAULT_PHOTOS;
  const captions = values.captions ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.paper}>
        <header className={styles.header}>
          <a className={styles.wordmark} href="/" aria-label="Paper Stish home">little album<span>♡</span></a>
          <p className={styles.headerNote}>A COLLECTION OF LITTLE MOMENTS</p>
        </header>

        <section className={styles.hero}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span aria-hidden="true">✳</span> OUR PHOTO ALBUM</p>
            <h1>{heading}</h1>
            <p className={styles.message}>{message}</p>
            <div className={styles.stamp}>
              <span className={styles.stampTop}>KEPT WITH LOVE</span>
              <span className={styles.stampHeart} aria-hidden="true">♡</span>
              <span className={styles.stampBottom}>{String(photos.length).padStart(2, "0")} MEMORIES</span>
            </div>
          </div>
          <figure className={styles.cover}>
            <div className={styles.coverMat}>
              <img src={photos[0]} alt={captions[0]?.trim() || DEFAULT_CAPTIONS[0]} />
            </div>
            <figcaption>{captions[0]?.trim() || DEFAULT_CAPTIONS[0]}</figcaption>
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
                <div className={styles.photoMat}>
                  <img
                    src={photo}
                    alt={captions[index]?.trim() || DEFAULT_CAPTIONS[index] || "Photo album memory"}
                    loading={index > 1 ? "lazy" : "eager"}
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span className={styles.photoNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span>{captions[index]?.trim() || DEFAULT_CAPTIONS[index] || "A favorite moment"}</span>
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
