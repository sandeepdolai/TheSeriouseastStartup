import type { TemplatePublicationValues } from "@/lib/publications";
import styles from "./LoveOfMyLifeTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type PersonalTemplateVariant = "love" | "birthday";

interface Props {
  values?: TemplatePublicationValues;
  title?: string;
  variant?: PersonalTemplateVariant;
}

/**
 * A fixed, code-authored website template. Only the value fields are supplied
 * by a user; markup, layout, styles and behavior always come from this code.
 */
export function LoveOfMyLifeTemplate({
  values = {},
  title,
  variant = "love",
}: Props) {
  const birthday = variant === "birthday";
  const heading =
    values.heading?.trim() ||
    (birthday ? "Happy Birthday, my favorite person" : "To the love of my life");
  const message =
    values.message?.trim() ||
    (birthday
      ? "I hope this next chapter brings you the same joy, kindness, and light that you bring into my life. You deserve every beautiful thing coming your way."
      : "Somehow, ordinary days become the ones I want to remember most when I spend them with you. Thank you for being my safe place, my favorite hello, and the person I want beside me for all the little things still to come.");
  const years = values.years?.trim();
  const yearsLabel =
    values.yearsLabel?.trim() || (birthday ? "years of being wonderful" : "years of us");
  const sideNote =
    values.sideNote?.trim() || (birthday ? "Today is all about you" : "My favorite person, always");
  const photo =
    values.photoUrl?.trim() ||
    BASE_PATH + "/templates/" + (birthday ? "love-favorite-person-art.webp" : "love-of-my-life-art.webp");

  return (
    <main className={styles.page + (birthday ? " " + styles.birthday : "")}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <a className={styles.wordmark} href="/" aria-label="Paper Stish home">
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
            <h1 id="personal-site-heading">{heading}</h1>
            <p className={styles.intro}>
              {birthday
                ? "One little corner of the internet, made to celebrate you."
                : "A small corner of the internet for everything I sometimes forget to say out loud."}
            </p>

            {years && (
              <div className={styles.years}>
                <strong>{years}</strong>
                <span>{yearsLabel}</span>
              </div>
            )}

            <p className={styles.sideNote}>
              <span aria-hidden="true">↳</span> {sideNote}
            </p>
          </div>

          <figure className={styles.photoFrame}>
            <div className={styles.photoMat}>
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
            <h2 id="personal-site-note">
              {birthday ? "I hope you feel how loved you are." : "If I could keep one thing forever…"}
            </h2>
            <p>{message}</p>
            <p className={styles.signature}>
              {birthday ? "Celebrating you, always" : "Always on your side"}
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
