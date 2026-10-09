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
import { LoveOfMyLifeTemplate } from "./LoveOfMyLifeTemplate";
import styles from "./WebsiteTemplateBuilder.module.css";

const DEFAULT_VALUES: TemplatePublicationValues = {
  heading: "To the love of my life",
  years: "",
  yearsLabel: "years of us",
  sideNote: "My favorite person, always",
  message:
    "Somehow, ordinary days become the ones I want to remember most when I spend them with you. Thank you for being my safe place, my favorite hello, and the person I want beside me for all the little things still to come.",
  photoUrl: null,
};

async function optimizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file such as JPG, PNG, or WEBP.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("That photo is over 15 MB. Choose a smaller image.");
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read this photo."));
    };
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("This photo could not be opened."));
    element.src = source;
  });

  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  if (dataUrl.length > 2_200_000) dataUrl = canvas.toDataURL("image/jpeg", 0.58);
  if (dataUrl.length > 2_800_000) {
    throw new Error("This photo is still too large after compression. Choose another image.");
  }
  return dataUrl;
}

export function WebsiteTemplateBuilder() {
  const { data: session, status } = useSession();
  const [values, setValues] = useState<TemplatePublicationValues>(DEFAULT_VALUES);
  const [username, setUsername] = useState("");
  const [websiteName, setWebsiteName] = useState("our-story");
  const [photoName, setPhotoName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<PublishedRecord | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem("paper-stish-publish-username");
      if (remembered) setUsername(remembered);
    } catch {
      // Remembered values are optional convenience only.
    }
  }, []);

  const changeValue = (key: keyof TemplatePublicationValues, value: string | null) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoLoading(true);
    setError("");
    try {
      const photoUrl = await optimizePhoto(file);
      changeValue("photoUrl", photoUrl);
      setPhotoName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use this photo.");
    } finally {
      setPhotoLoading(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  };

  const publish = async () => {
    if (status === "loading" || publishing) return;
    if (status !== "authenticated" || !session?.user) {
      void signIn("google");
      return;
    }

    const safeUsername = slugPart(username, "");
    const safeWebsiteName = slugPart(websiteName, "");
    if (!safeUsername || !safeWebsiteName) {
      setError("Enter a public username and website link name using letters or numbers.");
      return;
    }

    setPublishing(true);
    setError("");
    try {
      const result = await publishWebsite({
        templateSlug: "love-of-my-life",
        title: values.heading?.trim().slice(0, 120) || "Love of My Life",
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
        // Storing this convenience value is optional.
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
      const input = document.getElementById("published-website-url") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  };

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/">Paper Stish</a>
        <div className={styles.topbarRight}>
          <span>Website Templates · Test build</span>
          <a className={styles.backLink} href="/">Exit</a>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.editorColumn} aria-label="Edit website template">
          <div className={styles.headingBlock}>
            <p className={styles.kicker}>Code-based template / 01</p>
            <h1>Love of My Life</h1>
            <p>Edit the text and photos. The website layout is built in code and stays consistent on every device.</p>
          </div>

          <div className={styles.formPanel}>
            <div className={styles.sectionTitle}>
              Your website
              <span>Changes update the preview</span>
            </div>

            <label className={styles.field}>
              <span>Main heading</span>
              <input
                className={styles.input}
                value={values.heading ?? ""}
                maxLength={200}
                onChange={(event) => {
                  changeValue("heading", event.target.value);
                }}
                placeholder="To the love of my life"
              />
            </label>

            <div className={styles.linkFields}>
              <label className={styles.field}>
                <span>Years together (optional)</span>
                <input
                  className={styles.input}
                  value={values.years ?? ""}
                  maxLength={40}
                  onChange={(event) => {
                    changeValue("years", event.target.value);
                  }}
                  placeholder="3"
                />
              </label>
              <label className={styles.field}>
                <span>Years label</span>
                <input
                  className={styles.input}
                  value={values.yearsLabel ?? ""}
                  maxLength={80}
                  onChange={(event) => {
                    changeValue("yearsLabel", event.target.value);
                  }}
                  placeholder="years of us"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Small note under heading</span>
              <input
                className={styles.input}
                value={values.sideNote ?? ""}
                maxLength={80}
                onChange={(event) => {
                  changeValue("sideNote", event.target.value);
                }}
                placeholder="My favorite person, always"
              />
            </label>

            <label className={styles.field}>
              <span>Your message</span>
              <textarea
                className={styles.textarea}
                value={values.message ?? ""}
                maxLength={4000}
                onChange={(event) => {
                  changeValue("message", event.target.value);
                }}
                placeholder="Write something personal..."
              />
              <span className={styles.helper}>{(values.message ?? "").length}/4000 characters</span>
            </label>

            <div className={styles.divider} />

            <div className={styles.sectionTitle}>
              Your photo
              <span>Optimized before publishing</span>
            </div>
            <div className={styles.photoTools}>
              <input
                ref={photoInput}
                className={styles.hiddenInput}
                type="file"
                accept="image/*"
                aria-label="Choose a photo"
                onChange={(event) => void choosePhoto(event.target.files?.[0])}
              />
              <button
                type="button"
                className={styles.uploadButton}
                disabled={photoLoading}
                onClick={() => photoInput.current?.click()}
              >
                {photoLoading ? "Preparing photo…" : values.photoUrl ? "Replace photo" : "Upload photo"}
              </button>
              {values.photoUrl && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    changeValue("photoUrl", null);
                    setPhotoName("");
                  }}
                >
                  Remove
                </button>
              )}
              <span className={styles.uploadName}>{photoName || (values.photoUrl ? "Photo added" : "Optional · JPG, PNG, WEBP")}</span>
            </div>
            <p className={styles.helper}>The photo is resized in your browser before it is saved with the published website.</p>

            <div className={styles.divider} />

            <div className={styles.sectionTitle}>
              Your public link
              <span>Visitors do not need an account</span>
            </div>
            <div className={styles.linkFields}>
              <label className={styles.field}>
                <span>Public username</span>
                <input
                  className={styles.input}
                  value={username}
                  maxLength={60}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(event) => {
                    setUsername(event.target.value);
                  }}
                  placeholder="your-name"
                />
              </label>
              <label className={styles.field}>
                <span>Website link name</span>
                <input
                  className={styles.input}
                  value={websiteName}
                  maxLength={60}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(event) => {
                    setWebsiteName(event.target.value);
                  }}
                  placeholder="our-story"
                />
              </label>
            </div>
            <p className={styles.helper}>
              Link preview: /{slugPart(username, "your-name")}/{slugPart(websiteName, "our-story")}/[id]
            </p>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button
              type="button"
              className={styles.publishButton}
              disabled={publishing || photoLoading || status === "loading"}
              onClick={() => void publish()}
            >
              {publishing ? "Publishing website…" : published ? "Republish website" : status === "authenticated" ? "Publish website" : "Sign in to publish"}
            </button>

            {published && (
              <div className={styles.published} role="status">
                <p className={styles.publishedTitle}>Your coded website is live.</p>
                <input
                  id="published-website-url"
                  className={styles.publishedLink}
                  value={published.url}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="Published website URL"
                />
                <div className={styles.publishedActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => void copyLink()}>
                    Copy link
                  </button>
                  <a className={styles.uploadButton} href={published.url} target="_blank" rel="noreferrer">
                    Open website
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.previewColumn} aria-label="Live website preview">
          <div className={styles.previewHeader}>
            <span>Live preview</span>
            <span>Mobile-friendly · Fixed template code</span>
          </div>
          <div className={styles.previewViewport}>
            <LoveOfMyLifeTemplate values={values} title={values.heading} />
          </div>
        </section>
      </div>
    </main>
  );
}
