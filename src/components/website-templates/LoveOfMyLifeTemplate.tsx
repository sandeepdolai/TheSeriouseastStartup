"use client";

import type { TemplatePublicationValues } from "@/lib/publications";
import { InlineEditableText } from "./InlineEditableText";
import styles from "./LoveOfMyLifeTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type PersonalTemplateVariant = "love" | "birthday";
type EditableField = "heading" | "intro" | "years" | "yearsLabel" | "sideNote" | "noteHeading" | "message" | "signature";

interface Props {
  values?: TemplatePublicationValues;
  title?: string;
  variant?: PersonalTemplateVariant;
  editing?: boolean;
  onTextChange?: (field: EditableField, value: string) => void;
  onPhotoClick?: (index: number) => void;
  onExit?: () => void;
}

/**
 * A fixed, code-authored website template. Edit mode only makes existing text
 * and the photo tappable; the same website markup and layout remain in place.
 */
export function LoveOfMyLifeTemplate({
  values = {},
  title,
  variant = "love",
  editing = false,
  onTextChange,
  onPhotoClick,
  onExit,
}: Props) {
  const birthday = variant === "birthday";
  const fallbackHeading = birthday ? "Happy Birthday, my favorite person" : "To the love of my life";
  const fallbackIntro = birthday
    ? "One little corner of the internet, made to celebrate you."
    : "A small corner of the internet for everything I sometimes forget to say out loud.";
  const fallbackMessage = birthday
    ? "I hope this next chapter brings you the same joy, kindness, and light that you bring into my life. You deserve every beautiful thing coming your way."
    : "Somehow, ordinary days become the ones I want to remember most when I spend them with you. Thank you for being my safe place, my favorite hello, and the person I want beside me for all the little things still to come.";
  const fallbackYearsLabel = birthday ? "years of being wonderful" : "years of us";
  const fallbackSideNote = birthday ? "Today is all about you" : "My favorite person, always";
  const fallbackNoteHeading = birthday ? "I hope you feel how loved you are." : "If I could keep one thing forever…";
  const fallbackSignature = birthday ? "Celebrating you, always" : "Always on your side";
  const heading = editing ? (values.heading ?? fallbackHeading) : values.heading?.trim() || fallbackHeading;
  const intro = editing ? (values.intro ?? fallbackIntro) : values.intro?.trim() || fallbackIntro;
  const message = editing ? (values.message ?? fallbackMessage) : values.message?.trim() || fallbackMessage;
  const years = values.years?.trim() ?? "";
  const yearsLabel = editing ? (values.yearsLabel ?? fallbackYearsLabel) : values.yearsLabel?.trim() || fallbackYearsLabel;
  const sideNote = editing ? (values.sideNote ?? fallbackSideNote) : values.sideNote?.trim() || fallbackSideNote;
  const noteHeading = editing ? (values.noteHeading ?? fallbackNoteHeading) : values.noteHeading?.trim() || fallbackNoteHeading;
  const signature = editing ? (values.signature ?? fallbackSignature) : values.signature?.trim() || fallbackSignature;
  const photo =
    values.photoUrl?.trim() ||
    BASE_PATH + "/templates/" + (birthday ? "love-favorite-person-art.webp" : "love-of-my-life-art.webp");

  return (
    <main className={styles.page + (birthday ? " " + styles.birthday : "")}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <a
            className={styles.wordmark}
            href="/"
            aria-label={editing ? "Back to website templates" : "Paper Stish home"}
            onClick={editing && onExit ? (event) => { event.preventDefault(); onExit(); } : undefined}
          >
            paper stish<span>♡</span>
          </a>
          <p className={styles.headerNote}>
            {birthday ? "A LITTLE BIRTHDAY SURPRISE" : "A LITTLE PAGE MADE FOR YOU"}
          </p>
        </header>

        <section className={styles.hero} aria-labelledby="personal-site-heading">
          <div className={styles.copy}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true">✳</span>
              {birthday ? "YOUR DAY, YOUR MOMENT" : "TO MY FAVORITE PERSON"}
            </p>
            <InlineEditableText
              as="h1"
              className={styles.mainHeading}
              value={heading}
              editing={editing}
              multiline
              ariaLabel="Website heading"
              onCommit={(value) => onTextChange?.("heading", value)}
            />
            <InlineEditableText
              as="p"
              className={styles.intro}
              value={intro}
              editing={editing}
              multiline
              ariaLabel="Introductory text"
              onCommit={(value) => onTextChange?.("intro", value)}
            />

            {years && (
              <div className={styles.years}>
                <InlineEditableText
                  as="strong"
                  value={years}
                  editing={editing}
                  ariaLabel="Years or number"
                  onCommit={(value) => onTextChange?.("years", value)}
                />
                <InlineEditableText
                  value={yearsLabel}
                  editing={editing}
                  ariaLabel="Years label"
                  onCommit={(value) => onTextChange?.("yearsLabel", value)}
                />
              </div>
            )}

            <p className={styles.sideNote}>
              <span aria-hidden="true">↳</span>{" "}
              <InlineEditableText
                value={sideNote}
                editing={editing}
                ariaLabel="Personal side note"
                onCommit={(value) => onTextChange?.("sideNote", value)}
              />
            </p>
          </div>

          <figure className={styles.photoFrame}>
            <div
              className={`${styles.photoMat} ${editing ? styles.editablePhoto : ""}`}
              role={editing ? "button" : undefined}
              tabIndex={editing ? 0 : undefined}
              aria-label={editing ? "Replace website photo" : undefined}
              title={editing ? "Tap to replace this photo" : undefined}
              onClick={editing ? () => onPhotoClick?.(0) : undefined}
              onKeyDown={editing ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPhotoClick?.(0);
                }
              } : undefined}
            >
              <img className={styles.photo} src={photo} alt={sideNote} />
            </div>
            <figcaption>
              <span>{birthday ? "A DAY WORTH CELEBRATING" : "A MOMENT I WANT TO KEEP"}</span>
              <span aria-hidden="true">♡</span>
            </figcaption>
            <img
              className={styles.bow}
              src={BASE_PATH + "/templates/love-bow.webp"}
              alt=""
              aria-hidden="true"
            />
          </figure>
        </section>

        <section className={styles.note} aria-labelledby="personal-site-note">
          <div className={styles.noteLabel}>
            <span>01</span>
            <span>{birthday ? "A NOTE FOR YOUR BIRTHDAY" : "A NOTE FROM ME TO YOU"}</span>
          </div>
          <div className={styles.noteBody}>
            <InlineEditableText
              as="h2"
              value={noteHeading}
              editing={editing}
              multiline
              ariaLabel="Message heading"
              onCommit={(value) => onTextChange?.("noteHeading", value)}
            />
            <InlineEditableText
              as="p"
              className={styles.noteMessage}
              value={message}
              editing={editing}
              multiline
              ariaLabel="Website message"
              onCommit={(value) => onTextChange?.("message", value)}
            />
            <p className={styles.signature}>
              <InlineEditableText
                value={signature}
                editing={editing}
                ariaLabel="Sign-off text"
                onCommit={(value) => onTextChange?.("signature", value)}
              />
              <span aria-hidden="true">♡</span>
            </p>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>MADE WITH A LITTLE EXTRA LOVE</span>
          <span>{title?.trim() || (birthday ? "For your birthday" : "For my favorite person")} · paper stish</span>
        </footer>
      </div>
    </main>
  );
}
