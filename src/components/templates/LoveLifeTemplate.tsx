"use client";

import { useEffect, useId, useRef } from "react";
import type { CSSProperties } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const LOVE_ASSETS = {
  texture: `${BASE_PATH}/templates/love-paper-texture.webp`,
  frame: `${BASE_PATH}/templates/love-polaroid-frame.webp`,
  cats: `${BASE_PATH}/templates/love-cats.webp`,
  love: `${BASE_PATH}/templates/love-of-my-life-art.webp`,
  favorite: `${BASE_PATH}/templates/love-favorite-person-art.webp`,
  bow: `${BASE_PATH}/templates/love-bow.webp`,
};

export const LOVE_DEFAULT_MESSAGE =
  '"I just want to tell you, thank you for coming into my life. You actually make me smile and laugh. Thank you for being understanding. Thank you for being my biggest supporter, and thank you for caring about me. I really appreciate you so much. I love you a lot."';

interface LoveLifeTemplateProps {
  years?: string;
  yearsLabel?: string;
  message?: string;
  photoUrl?: string | null;
  editable?: boolean;
  /**
   * Fit the collage to a sized container instead of the viewport. Requires an
   * ancestor with `container-type: size` (used by My Projects card previews).
   */
  fitToContainer?: boolean;
  onYearsChange?: (value: string) => void;
  onYearsLabelChange?: (value: string) => void;
  onMessageChange?: (value: string) => void;
  onPhotoChange?: (file: File | undefined) => void;
}

/**
 * Faithful conversion of the supplied "2 yers with you" HTML template.
 * The collage is one fixed-ratio stage; every size is in cqw so it scales as
 * a unit. Stage width follows the original `--w` formula: full width on
 * phones, scaled to the screen height on bigger screens.
 */
export function LoveLifeTemplate({
  years = "2",
  yearsLabel = "yers with you",
  message = LOVE_DEFAULT_MESSAGE,
  photoUrl = null,
  editable = false,
  fitToContainer = false,
  onYearsChange,
  onYearsLabelChange,
  onMessageChange,
  onPhotoChange,
}: LoveLifeTemplateProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const filterId = useId().replace(/:/g, "");

  useEffect(() => {
    const node = messageRef.current;
    const note = noteRef.current;
    if (!node || !note) return;

    const fit = () => {
      node.style.fontSize = "4.6cqw";
      let size = parseFloat(getComputedStyle(node).fontSize);
      let guard = 60;
      const max = note.clientHeight * 0.76;

      while (node.scrollHeight > max && size > 8 && guard-- > 0) {
        size -= 0.5;
        node.style.fontSize = size + "px";
      }
    };

    const ready = document.fonts?.ready ?? Promise.resolve();
    let cancelled = false;

    ready.then(() => {
      if (!cancelled) fit();
    });

    const observer = new ResizeObserver(fit);
    observer.observe(note);
    window.addEventListener("resize", fit);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [message]);

  const choosePhoto = () => {
    if (editable) photoInputRef.current?.click();
  };

  // The original page paints the paper texture on the root element, sized to
  // the collage width and offset so the pattern sits behind the composition.
  const stageWidth = fitToContainer
    ? "min(100%, calc(100cqh * 736 / 1308))"
    : "min(100%, max(480px, calc(100vh * 0.5628)))";

  const articleStyle = {
    "--w": stageWidth,
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    minHeight: fitToContainer ? 0 : "100vh",
    height: fitToContainer ? "100%" : undefined,
    overflowX: "clip",
    paddingTop: fitToContainer ? 0 : "env(safe-area-inset-top, 0px)",
    paddingBottom: fitToContainer ? 0 : "env(safe-area-inset-bottom, 0px)",
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    backgroundColor: "#e9e1dc",
    backgroundImage: `url("${LOVE_ASSETS.texture}"), radial-gradient(120% 70% at 30% 0%, #f1eae6 0%, transparent 65%)`,
    backgroundRepeat: "repeat, no-repeat",
    backgroundSize: "var(--w) auto, 100% 100%",
    backgroundPosition: "50% calc(var(--w) * -0.111), 0 0",
  } as CSSProperties;

  const stageStyle: CSSProperties = {
    position: "relative",
    width: "var(--w)",
    flex: "none",
    aspectRatio: "736 / 1308",
    containerType: "inline-size",
  };

  const polaroidStyle: CSSProperties = {
    position: "absolute",
    left: "9.5%",
    top: "27.2%",
    width: "81.3%",
    aspectRatio: "1016 / 1215",
  };

  return (
    <article className="w-full" style={articleStyle}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onPhotoChange?.(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{ position: "absolute" }}
      >
        <filter
          id={filterId}
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.07"
            numOctaves="2"
            seed="4"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" />
        </filter>
        <filter
          id={filterId + "light"}
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.09"
            numOctaves="2"
            seed="9"
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </svg>

      <section style={stageStyle} aria-label="Two years with you — anniversary collage">
        {/* polaroid: photo window behind, frame image on top */}
        <div style={polaroidStyle}>
          <button
            type="button"
            onClick={choosePhoto}
            aria-label="Add your photo"
            className="absolute z-[1] block overflow-hidden bg-black focus-visible:[outline:0.8cqw_solid_#f1e1b9] focus-visible:[outline-offset:-1cqw]"
            style={{
              left: "7.2%",
              top: "6.2%",
              width: "85.5%",
              height: "73.3%",
              cursor: editable ? "pointer" : "default",
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Your photo"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span
                className="absolute inset-0 grid place-items-center px-[4%] text-center"
                style={{
                  fontWeight: 700,
                  fontSize: "3.4cqw",
                  letterSpacing: ".08em",
                  color: "rgba(255,255,255,.22)",
                }}
              >
                TAP TO ADD YOUR PHOTO
              </span>
            )}
          </button>

          <img
            src={LOVE_ASSETS.frame}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 z-[2] h-full w-full select-none object-fill"
            style={{
              filter: "drop-shadow(0 .6cqw 1.4cqw rgba(60,10,15,.3))",
            }}
          />
        </div>

        <img
          src={LOVE_ASSETS.cats}
          alt="A black cat and a white cat cuddling"
          draggable={false}
          className="pointer-events-none absolute z-[4] block h-auto select-none"
          style={{
            left: "49.2%",
            top: "4.9%",
            width: "47%",
            filter: "drop-shadow(0 .4cqw .6cqw rgba(60,30,30,.22))",
          }}
        />

        <img
          src={LOVE_ASSETS.love}
          alt="love of my life"
          draggable={false}
          className="pointer-events-none absolute z-[4] block h-auto select-none"
          style={{
            left: "3.4%",
            top: "17.2%",
            width: "30.5%",
            transform: "rotate(-13deg)",
            filter: "drop-shadow(0 .3cqw .5cqw rgba(60,30,30,.25))",
          }}
        />

        <img
          src={LOVE_ASSETS.favorite}
          alt="Favorite person"
          draggable={false}
          className="pointer-events-none absolute z-[4] block h-auto select-none"
          style={{
            left: "80.6%",
            top: "44.3%",
            width: "23.5%",
            transform: "rotate(78deg)",
            filter: "drop-shadow(0 .3cqw .5cqw rgba(60,30,30,.25))",
          }}
        />

        <div
          className="absolute z-[3] flex items-end text-white"
          style={{ left: "10.2%", top: "72.4%" }}
          aria-label={`${years} ${yearsLabel}`}
        >
          <div
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) => onYearsChange?.(event.currentTarget.innerText)}
            className="select-text outline-none"
            style={{
              fontFamily: "'Anton', 'Impact', 'Arial Narrow', sans-serif",
              fontWeight: 400,
              fontSize: "14.5cqw",
              lineHeight: 0.9,
              WebkitTextStroke: ".7cqw #fff",
              filter: `url(#${filterId})`,
            }}
          >
            {years}
          </div>

          <div
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) =>
              onYearsLabelChange?.(event.currentTarget.innerText)
            }
            className="select-text whitespace-nowrap outline-none"
            style={{
              fontFamily: "'Anton', 'Impact', 'Arial Narrow', sans-serif",
              fontWeight: 400,
              fontSize: "4.7cqw",
              lineHeight: 1,
              letterSpacing: "-.02em",
              wordSpacing: ".35em",
              WebkitTextStroke: ".15cqw #fff",
              margin: "0 0 1.2cqw -.2cqw",
              filter: `url(#${filterId}light)`,
            }}
          >
            {yearsLabel}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute z-[3]"
          style={{
            left: "48.9%",
            top: "77.2%",
            width: "27.2%",
            height: "2.4%",
            background: "#f7f3ee",
            clipPath:
              "polygon(0 100%, 6% 30%, 30% 0, 70% 0, 94% 30%, 100% 100%)",
          }}
        />

        <div
          ref={noteRef}
          className="absolute z-[3] grid place-items-center text-center"
          style={{
            left: "31.8%",
            top: "79.3%",
            width: "54.3%",
            height: "18.6%",
            padding: "7% 3% 3%",
            background:
              "radial-gradient(circle at 20% 15%, rgba(255,255,255,.35), transparent 60%), #f1e1b9",
            boxShadow: "0 .6cqw 1.6cqw rgba(50,25,10,.28)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute"
            style={{
              left: "49.5%",
              top: "2.2%",
              width: "3.4cqw",
              height: "3.4cqw",
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "inset 0 0 0 .2cqw rgba(0,0,0,.08)",
              transform: "translateX(-50%)",
            }}
          />

          <p
            ref={messageRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) => onMessageChange?.(event.currentTarget.innerText)}
            className="m-0 select-text uppercase outline-none"
            style={{
              fontFamily: "'Caveat Brush', 'Amatic SC', 'Arial Narrow', sans-serif",
              fontWeight: 400,
              color: "#14110f",
              fontSize: "4.6cqw",
              lineHeight: 1.22,
              wordSpacing: ".22em",
              WebkitTextStroke: ".08cqw #14110f",
              textWrap: "balance",
            }}
          >
            {message}
          </p>
        </div>

        <img
          src={LOVE_ASSETS.bow}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute z-[5] block h-auto select-none"
          style={{
            left: "44.6%",
            top: "72.2%",
            width: "37.5%",
            filter: "drop-shadow(0 .3cqw .4cqw rgba(60,40,20,.25))",
          }}
        />
      </section>
    </article>
  );
}
