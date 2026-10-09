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
import { PhotoAlbumTemplate, DEFAULT_ALBUM_CAPTIONS, DEFAULT_ALBUM_PHOTOS } from "./PhotoAlbumTemplate";
import { LoveOfMyLifeTemplate } from "./LoveOfMyLifeTemplate";
import styles from "./WebsiteEditor.module.css";

export type WebsiteEditorTemplateSlug = "love-of-my-life" | "birthday-template" | "photo-album";

type EditableWebsiteField =
  | "heading"
  | "intro"
  | "years"
  | "yearsLabel"
  | "sideNote"
  | "noteHeading"
  | "message"
  | "signature";

const MAX_ALBUM_PHOTOS = 6;
const MAX_PHOTO_DATA_LENGTH = 560_000;
const REOPEN_PUBLISH_KEY = "paper-stish-reopen-website-publish";

const TEXT_DEFAULTS: Record<WebsiteEditorTemplateSlug, TemplatePublicationValues> = {
  "love-of-my-life": {
    heading: "To the love of my life",
    intro: "A small corner of the internet for everything I sometimes forget to say out loud.",
    noteHeading: "If I could keep one thing forever…",
    message: "Somehow, ordinary days become the ones I want to remember most when I spend them with you. Thank you for being my safe place, my favorite hello, and the person I want beside me for all the little things still to come.",
    sideNote: "My favorite person, always",
    signature: "Always on your side",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "birthday-template": {
    heading: "Happy Birthday, my favorite person",
    intro: "One little corner of the internet, made to celebrate you.",
    noteHeading: "I hope you feel how loved you are.",
    message: "I hope this next chapter brings you the same joy, kindness, and light that you bring into my life. You deserve every beautiful thing coming your way.",
    sideNote: "Today is all about you",
    signature: "Celebrating you, always",
    photoUrl: null,
    images: [],
    captions: [],
  },
  "photo-album": {
    heading: "A little album of us",
    message: "The days go by quickly. These are the moments I want to keep close, one little memory at a time.",
    photoUrl: null,
    images: [],
    captions: [],
  },
};

const TEMPLATE_TITLES: Record<WebsiteEditorTemplateSlug, string> = {
  "love-of-my-life": "Love of My Life",
  "birthday-template": "Birthday Website",
  "photo-album": "Photo Album",
};

function defaultValues(templateSlug: WebsiteEditorTemplateSlug): TemplatePublicationValues {
  return { ...TEXT_DEFAULTS[templateSlug] };
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

/**
 * The template itself is the editor. Photo and text interactions are attached
 * to the real website elements; there is no separate editor column or preview.
 */
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
  const [websiteName, setWebsiteName] = useState(
    templateSlug === "photo-album" ? "photo-album" : templateSlug === "birthday-template" ? "birthday" : "our-story",
  );
  const [draftReady, setDraftReady] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedRecord | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [editingPublishDetails, setEditingPublishDetails] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const publishedLinkInput = useRef<HTMLInputElement>(null);
  const targetPhotoIndex = useRef(0);
  const isAlbum = templateSlug === "photo-album";
  const title = TEMPLATE_TITLES[templateSlug];
  const showPublishResult = Boolean(published && !hasUnpublishedChanges && !editingPublishDetails);

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
          const photoUrl =
            typeof raw.photoUrl === "string" &&
            raw.photoUrl.length <= 1_800_000 &&
            /^(data:image\/|https?:\/\/)/.test(raw.photoUrl)
              ? raw.photoUrl
              : null;
          const images = Array.isArray(raw.images)
            ? raw.images.filter((item): item is string =>
                typeof item === "string" &&
                item.length <= MAX_PHOTO_DATA_LENGTH &&
                /^(data:image\/|https?:\/\/)/.test(item)).slice(0, MAX_ALBUM_PHOTOS)
            : [];
          const captions = Array.isArray(raw.captions)
            ? raw.captions.filter((item): item is string => typeof item === "string").slice(0, MAX_ALBUM_PHOTOS)
            : [];
          setValues({
            ...defaults,
            heading: text("heading", defaults.heading ?? "", 160),
            intro: text("intro", defaults.intro ?? "", 400),
            noteHeading: text("noteHeading", defaults.noteHeading ?? "", 240),
            signature: text("signature", defaults.signature ?? "", 160),
            years: text("years", defaults.years ?? "", 40),
            yearsLabel: text("yearsLabel", defaults.yearsLabel ?? "", 80),
            sideNote: text("sideNote", defaults.sideNote ?? "", 80),
            message: text("message", defaults.message ?? "", 1200),
            photoUrl,
            images,
            captions,
          });
        }
        if (typeof draft.username === "string") setUsername(draft.username.slice(0, 60));
        if (typeof draft.websiteName === "string") setWebsiteName(draft.websiteName.slice(0, 60));
      }
      if (window.localStorage.getItem(REOPEN_PUBLISH_KEY) === "1") {
        window.localStorage.removeItem(REOPEN_PUBLISH_KEY);
        setPublishDialogOpen(true);
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

  const changeText = (field: EditableWebsiteField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setHasUnpublishedChanges(true);
  };

  const changeCaption = (index: number, value: string) => {
    setValues((current) => {
      const captions = [
        ...(current.captions ?? []),
        ...DEFAULT_ALBUM_CAPTIONS.slice(current.captions?.length ?? 0),
      ].slice(0, MAX_ALBUM_PHOTOS);
      captions[index] = value;
      return { ...current, captions };
    });
    setHasUnpublishedChanges(true);
  };

  const openPhotoChooser = (index: number) => {
    targetPhotoIndex.current = index;
    fileInput.current?.click();
  };

  const choosePhoto = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setError("");
    try {
      const optimized = await optimizePhoto(file);
      if (isAlbum) {
        const index = Math.min(MAX_ALBUM_PHOTOS - 1, targetPhotoIndex.current);
        setValues((current) => {
          const savedImages = current.images ?? [];
          const photos = [...savedImages, ...DEFAULT_ALBUM_PHOTOS.slice(savedImages.length)].slice(0, MAX_ALBUM_PHOTOS);
          photos[index] = optimized;
          const savedCaptions = current.captions ?? [];
          const captions = [
            ...savedCaptions,
            ...DEFAULT_ALBUM_CAPTIONS.slice(savedCaptions.length),
          ].slice(0, MAX_ALBUM_PHOTOS);
          return { ...current, images: photos, captions };
        });
      } else {
        setValues((current) => ({ ...current, photoUrl: optimized }));
      }
      setHasUnpublishedChanges(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this photo.");
    } finally {
      setPhotoLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const publish = async () => {
    if (status === "loading" || publishing || photoLoading) return;

    const safeUsername = slugPart(username, "");
    const safeWebsiteName = slugPart(websiteName, "");
    if (!safeUsername || !safeWebsiteName) {
      setError("Add a username and link name using letters or numbers.");
      return;
    }

    if (status !== "authenticated" || !session?.user) {
      try {
        window.localStorage.setItem(REOPEN_PUBLISH_KEY, "1");
      } catch {
        // The direct editor state will still be kept as a local draft.
      }
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      void signIn("google", {
        callbackUrl: window.location.origin + basePath + "/website-templates?edit=" + templateSlug,
      });
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
      setHasUnpublishedChanges(false);
      setEditingPublishDetails(false);
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
      publishedLinkInput.current?.focus();
      publishedLinkInput.current?.select();
    }
  };

  return (
    <main className={styles.screen}>
      <input
        ref={fileInput}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        aria-label="Choose a replacement website photo"
        onChange={(event) => void choosePhoto(event.currentTarget.files)}
      />

      {isAlbum ? (
        <PhotoAlbumTemplate
          values={values}
          title={values.heading}
          editing
          onTextChange={changeText}
          onCaptionChange={changeCaption}
          onPhotoClick={openPhotoChooser}
          onExit={onClose}
        />
      ) : (
        <LoveOfMyLifeTemplate
          values={values}
          title={values.heading}
          variant={templateSlug === "birthday-template" ? "birthday" : "love"}
          editing
          onTextChange={changeText}
          onPhotoClick={openPhotoChooser}
          onExit={onClose}
        />
      )}

      <button
        type="button"
        className={styles.publishButton}
        onClick={() => {
          setEditingPublishDetails(false);
          setError("");
          setPublishDialogOpen(true);
        }}
      >
        {published && !hasUnpublishedChanges ? "Share website" : "Publish website"}
      </button>

      {photoLoading && <p className={styles.notice} role="status">Preparing photo…</p>}
      {error && !publishDialogOpen && <p className={styles.notice} role="alert">{error}</p>}

      {publishDialogOpen && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPublishDialogOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setPublishDialogOpen(false);
          }}
        >
          <form
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="website-publish-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (showPublishResult) {
                setPublishDialogOpen(false);
                return;
              }
              void publish();
            }}
          >
            <button
              type="button"
              className={styles.dialogClose}
              aria-label="Close publish dialog"
              onClick={() => setPublishDialogOpen(false)}
            >
              ×
            </button>

            {showPublishResult ? (
              <>
                <p className={styles.dialogEyebrow}>YOUR WEBSITE IS LIVE</p>
                <h2 id="website-publish-title" className={styles.dialogTitle}>Ready to share.</h2>
                <p className={styles.dialogCopy}>Your website is published. Send this link to anyone you want to share it with.</p>
                <input
                  ref={publishedLinkInput}
                  className={styles.publishedLink}
                  value={published?.url ?? ""}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="Published website link"
                />
                <div className={styles.dialogActions}>
                  <button type="button" className={styles.secondaryAction} onClick={() => void copyLink()}>Copy link</button>
                  <a className={styles.secondaryAction} href={published?.url} target="_blank" rel="noreferrer">Open website</a>
                </div>
                <button type="button" className={styles.primaryAction} onClick={() => setPublishDialogOpen(false)}>Done</button>
                <button type="button" className={styles.textAction} onClick={() => setEditingPublishDetails(true)}>Edit link details</button>
              </>
            ) : (
              <>
                <p className={styles.dialogEyebrow}>ONE LITTLE LINK, ALL YOURS</p>
                <h2 id="website-publish-title" className={styles.dialogTitle}>Make it shareable.</h2>
                <p className={styles.dialogCopy}>Choose the address for your website. The design and everything you just edited stay exactly as they are.</p>
                <label className={styles.field}>
                  <span>Your username</span>
                  <input
                    className={styles.textInput}
                    value={username}
                    maxLength={60}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your-name"
                    autoComplete="username"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Link name</span>
                  <input
                    className={styles.textInput}
                    value={websiteName}
                    maxLength={60}
                    onChange={(event) => setWebsiteName(event.target.value)}
                    placeholder="our-story"
                    required
                  />
                </label>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button
                  type="submit"
                  className={styles.primaryAction}
                  disabled={publishing || photoLoading || status === "loading"}
                >
                  {publishing ? "Publishing…" : status === "authenticated" ? (published ? "Update website" : "Publish website") : "Sign in and publish"}
                </button>
                <p className={styles.dialogFootnote}>Your draft saves on this device while you edit.</p>
              </>
            )}
          </form>
        </div>
      )}
    </main>
  );
}
