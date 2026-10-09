"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import {
  publishResultToRecord,
  publishWebsite,
  slugPart,
  type PublishedRecord,
  type TemplatePublicationValues,
} from "@/lib/publications";
import { PhotoAlbumTemplate } from "./PhotoAlbumTemplate";
import { LoveOfMyLifeTemplate } from "./LoveOfMyLifeTemplate";
import styles from "./WebsiteEditor.module.css";

export type WebsiteEditorTemplateSlug = "love-of-my-life" | "birthday-template" | "photo-album";

const MAX_ALBUM_PHOTOS = 6;
const MAX_PHOTO_DATA_LENGTH = 560_000;

const TEXT_DEFAULTS: Record<WebsiteEditorTemplateSlug, { heading: string; message: string }> = {
  "love-of-my-life": {
    heading: "To the love of my life",
    message: "Somehow, ordinary days become the ones I want to remember most when I spend them with you. Thank you for being my safe place, my favorite hello, and the person I want beside me for all the little things still to come.",
  },
  "birthday-template": {
    heading: "Happy Birthday, my favorite person",
    message: "I hope this next chapter brings you the same joy, kindness, and light that you bring into my life. You deserve every beautiful thing coming your way.",
  },
  "photo-album": {
    heading: "A little album of us",
    message: "The days go by quickly. These are the moments I want to keep close, one little memory at a time.",
  },
};

const TEMPLATE_TITLES: Record<WebsiteEditorTemplateSlug, string> = {
  "love-of-my-life": "Love of My Life",
  "birthday-template": "Birthday Website",
  "photo-album": "Photo Album",
};

function defaultValues(templateSlug: WebsiteEditorTemplateSlug): TemplatePublicationValues {
  return {
    heading: TEXT_DEFAULTS[templateSlug].heading,
    message: TEXT_DEFAULTS[templateSlug].message,
    photoUrl: null,
    images: [],
    captions: [],
  };
}

async function optimizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image such as JPG, PNG, or WEBP.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Each selected photo must be smaller than 15 MB.");
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Could not read this photo."));
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("This photo could not be opened."));
    element.src = source;
  });

  const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.72, 0.6, 0.48, 0.38]) {
    const result = canvas.toDataURL("image/jpeg", quality);
    if (result.length <= MAX_PHOTO_DATA_LENGTH) return result;
  }
  throw new Error("This photo is too detailed to upload. Choose a smaller image.");
}

export function WebsiteEditor({
  templateSlug,
  onClose,
}: {
  templateSlug: WebsiteEditorTemplateSlug;
  onClose: () => void;
}) {
  const { data: session, status } = useSession();
  const [values, setValues] = useState<TemplatePublicationValues>(() => defaultValues(templateSlug));
  const [username, setUsername] = useState("");
  const [websiteName, setWebsiteName] = useState(templateSlug === "photo-album" ? "photo-album" : templateSlug === "birthday-template" ? "birthday" : "our-story");
  const [draftReady, setDraftReady] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedRecord | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isAlbum = templateSlug === "photo-album";
  const title = TEMPLATE_TITLES[templateSlug];

  useEffect(() => {
    const defaults = defaultValues(templateSlug);
    try {
      const draftRaw = window.localStorage.getItem("paper-stish-website-draft:" + templateSlug);
      const rememberedUsername = window.localStorage.getItem("paper-stish-publish-username");
      if (rememberedUsername) setUsername(rememberedUsername.slice(0, 60));
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as Record<string, unknown>;
        if (draft.values && typeof draft.values === "object" && !Array.isArray(draft.values)) {
          const raw = draft.values as Record<string, unknown>;
          const text = (key: string, fallback: string, max: number) =>
            typeof raw[key] === "string" ? (raw[key] as string).slice(0, max) : fallback;
          const photoUrl = typeof raw.photoUrl === "string" &&
            raw.photoUrl.length <= 1_800_000 &&
            /^(data:image\/|https?:\/\/)/.test(raw.photoUrl) ? raw.photoUrl : null;
          const images = Array.isArray(raw.images)
            ? raw.images.filter((item): item is string =>
                typeof item === "string" && item.length <= MAX_PHOTO_DATA_LENGTH &&
                /^(data:image\/|https?:\/\/)/.test(item)).slice(0, MAX_ALBUM_PHOTOS)
            : [];
          const captions = Array.isArray(raw.captions)
            ? raw.captions.filter((item): item is string => typeof item === "string").slice(0, MAX_ALBUM_PHOTOS)
            : [];
          setValues({
            ...defaults,
            heading: text("heading", defaults.heading ?? "", 160),
            message: text("message", defaults.message ?? "", 1200),
            photoUrl,
            images,
            captions,
          });
        }
        if (typeof draft.username === "string") setUsername(draft.username.slice(0, 60));
        if (typeof draft.websiteName === "string") setWebsiteName(draft.websiteName.slice(0, 60));
      }
    } catch {
      // A damaged local draft should not stop the editor.
    }
    setDraftReady(true);
  }, [templateSlug]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      window.localStorage.setItem(
        "paper-stish-website-draft:" + templateSlug,
        JSON.stringify({ values, username, websiteName }),
      );
    } catch {
      // Drafts are a convenience; the current edit session still works.
    }
  }, [draftReady, templateSlug, values, username, websiteName]);

  const changeValue = <K extends keyof TemplatePublicationValues>(
    key: K,
    value: TemplatePublicationValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const chooseImages = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setPhotoLoading(true);
    setError("");
    try {
      if (isAlbum) {
        const currentCount = values.images?.length ?? 0;
        const available = Math.max(0, MAX_ALBUM_PHOTOS - currentCount);
        if (available === 0) throw new Error("This album can hold up to six photos.");
        const chosen = files.slice(0, available);
        const optimized = await Promise.all(chosen.map(optimizePhoto));
        setValues((current) => ({
          ...current,
          images: [...(current.images ?? []), ...optimized].slice(0, MAX_ALBUM_PHOTOS),
          captions: [...(current.captions ?? []), ...optimized.map(() => "")].slice(0, MAX_ALBUM_PHOTOS),
        }));
        if (files.length > available) {
          setError("Added six photos maximum. Remove one before adding more.");
        }
      } else {
        changeValue("photoUrl", await optimizePhoto(files[0]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this photo.");
    } finally {
      setPhotoLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setValues((current) => ({
      ...current,
      images: (current.images ?? []).filter((_, itemIndex) => itemIndex !== index),
      captions: (current.captions ?? []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const publish = async () => {
    if (status === "loading" || publishing || photoLoading) return;
    if (status !== "authenticated" || !session?.user) {
      void signIn("google");
      return;
    }

    const safeUsername = slugPart(username, "");
    const safeWebsiteName = slugPart(websiteName, "");
    if (!safeUsername || !safeWebsiteName) {
      setError("Enter a username and link name using letters or numbers.");
      return;
    }

    setPublishing(true);
    setError("");
    try {
      const result = await publishWebsite({
        templateSlug,
        title: values.heading?.trim().slice(0, 120) || title,
        username: safeUsername,
        viewerName: safeWebsiteName,
        ...(published?.templateId ? { previousTemplateId: published.templateId } : {}),
        data: { values },
      });
      const record = publishResultToRecord(result);
      setPublished(record);
      try {
        window.localStorage.setItem("paper-stish-publish-username", record.username);
      } catch {
        // Optional convenience value.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish this website. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(published.url);
    } catch {
      const input = document.getElementById("website-editor-published-url") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  };

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" onClick={(event) => { event.preventDefault(); onClose(); }}>
          Paper Stish
        </a>
        <div className={styles.topbarRight}>
          <span>{title}</span>
          <button type="button" className={styles.backButton} onClick={onClose}>Back to templates</button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.editorColumn} aria-label="Website content editor">
          <div className={styles.headingBlock}>
            <p className={styles.kicker}>YOUR WEBSITE</p>
            <h1>Make it yours.</h1>
            <p>Only your photos and words can change. The design stays just as it is.</p>
          </div>

          <section className={styles.section} aria-labelledby="website-images-heading">
            <div className={styles.sectionHeading}>
              <h2 id="website-images-heading">Images</h2>
              <span>{isAlbum ? (values.images?.length ?? 0) + " / 6" : "One photo"}</span>
            </div>
            {isAlbum ? (
              <>
                {(values.images ?? []).length > 0 ? (
                  <div className={styles.photoList}>
                    {(values.images ?? []).map((image, index) => (
                      <div className={styles.photoRow} key={index}>
                        <img src={image} alt={"Album upload " + (index + 1)} className={styles.thumbnail} />
                        <div className={styles.photoDetails}>
                          <span className={styles.photoNumber}>PHOTO {String(index + 1).padStart(2, "0")}</span>
                          <input
                            className={styles.input}
                            value={values.captions?.[index] ?? ""}
                            maxLength={120}
                            onChange={(event) => {
                              const captions = [...(values.captions ?? [])];
                              captions[index] = event.target.value;
                              changeValue("captions", captions);
                            }}
                            placeholder="Add a photo caption"
                            aria-label={"Caption for photo " + (index + 1)}
                          />
                        </div>
                        <button type="button" className={styles.removeButton} onClick={() => removePhoto(index)} aria-label={"Remove photo " + (index + 1)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.hint}>Add up to six of your favorite photos. The album layout is already designed.</p>
                )}
                <input
                  ref={fileInput}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  multiple
                  aria-label="Choose album photos"
                  onChange={(event) => void chooseImages(event.currentTarget.files)}
                />
                <button
                  type="button"
                  className={styles.uploadButton}
                  disabled={photoLoading || (values.images?.length ?? 0) >= MAX_ALBUM_PHOTOS}
                  onClick={() => fileInput.current?.click()}
                >
                  {photoLoading ? "Preparing photos…" : (values.images?.length ?? 0) ? "Add more photos" : "Choose photos"}
                </button>
              </>
            ) : (
              <>
                {values.photoUrl ? (
                  <div className={styles.singlePhoto}>
                    <img src={values.photoUrl} alt="Selected website photo" />
                    <button type="button" className={styles.removeSingle} onClick={() => changeValue("photoUrl", null)}>Remove photo</button>
                  </div>
                ) : (
                  <p className={styles.hint}>Choose one photo for your website. The template supplies a preview image until you add yours.</p>
                )}
                <input
                  ref={fileInput}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  aria-label="Choose website photo"
                  onChange={(event) => void chooseImages(event.currentTarget.files)}
                />
                <button type="button" className={styles.uploadButton} disabled={photoLoading} onClick={() => fileInput.current?.click()}>
                  {photoLoading ? "Preparing photo…" : values.photoUrl ? "Replace photo" : "Choose photo"}
                </button>
              </>
            )}
          </section>

          <section className={styles.section} aria-labelledby="website-text-heading">
            <div className={styles.sectionHeading}>
              <h2 id="website-text-heading">Text</h2>
              <span>Words only</span>
            </div>
            <label className={styles.field}>
              <span>Title</span>
              <input
                className={styles.input}
                value={values.heading ?? ""}
                maxLength={160}
                onChange={(event) => changeValue("heading", event.target.value)}
                placeholder="Your title"
              />
            </label>
            <label className={styles.field}>
              <span>Message</span>
              <textarea
                className={styles.textarea}
                value={values.message ?? ""}
                maxLength={1200}
                onChange={(event) => changeValue("message", event.target.value)}
                placeholder="Write a message..."
                rows={4}
              />
            </label>
          </section>

          <section className={styles.publishSection} aria-label="Publish website">
            <p className={styles.publishHeading}>Share your website</p>
            <div className={styles.linkFields}>
              <label className={styles.field}>
                <span>Your username</span>
                <input className={styles.input} value={username} maxLength={60} onChange={(event) => setUsername(event.target.value)} placeholder="your-name" />
              </label>
              <label className={styles.field}>
                <span>Link name</span>
                <input className={styles.input} value={websiteName} maxLength={60} onChange={(event) => setWebsiteName(event.target.value)} placeholder="our-album" />
              </label>
            </div>
            <button type="button" className={styles.publishButton} disabled={publishing || photoLoading || status === "loading"} onClick={() => void publish()}>
              {publishing ? "Publishing…" : published ? "Update website" : status === "authenticated" ? "Publish website" : "Sign in to publish"}
            </button>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {published && (
              <div className={styles.published} role="status">
                <p>Your website is published.</p>
                <input id="website-editor-published-url" className={styles.publishedLink} value={published.url} readOnly onFocus={(event) => event.currentTarget.select()} aria-label="Published website link" />
                <div className={styles.publishedActions}>
                  <button type="button" onClick={() => void copyLink()}>Copy link</button>
                  <a href={published.url} target="_blank" rel="noreferrer">Open website</a>
                </div>
              </div>
            )}
          </section>
        </aside>

        <section className={styles.previewColumn} aria-label="Live website preview">
          <div className={styles.previewHeader}>
            <span>Live preview</span>
            <span>Fixed design · Mobile-friendly</span>
          </div>
          <div className={styles.previewViewport}>
            {isAlbum ? (
              <PhotoAlbumTemplate values={values} title={values.heading} />
            ) : (
              <LoveOfMyLifeTemplate
                values={values}
                title={values.heading}
                variant={templateSlug === "birthday-template" ? "birthday" : "love"}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
