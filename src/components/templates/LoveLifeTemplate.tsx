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
  onYearsChange?: (value: string) => void;
  onYearsLabelChange?: (value: string) => void;
  onMessageChange?: (value: string) => void;
  onPhotoChange?: (file: File | undefined) => void;
}

const abs = (
  extra: CSSProperties,
  className = "",
): CSSProperties & { className?: string } => ({
  position: "absolute",
  ...extra,
  ...(className ? { className } : {}),
});

export function LoveLifeTemplate({
  years = "2",
  yearsLabel = "yers with you",
  message = LOVE_DEFAULT_MESSAGE,
  photoUrl = null,
  editable = false,
  onYearsChange,
  onYearsLabelChange,
  onMessageChange,
  onPhotoChange,
}: LoveLifeTemplateProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const filterId = useId().replace(/:/g, "");

  useEffect(() => {
    const node = messageRef.current;
    const note = node?.parentElement;
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

  const stageStyle: CSSProperties = {
    position: "relative",
    width: "min(100%, max(480px, calc(100dvh * 0.5628)))",
    flex: "none",
    aspectRatio: "736 / 1308",
    containerType: "inline-size",
    backgroundColor: "#e9e1dc",
    backgroundImage: `url("${LOVE_ASSETS.texture}")`,
    backgroundRepeat: "repeat",
    backgroundSize: "100% auto",
    overflow: "hidden",
  };

  const polaroidStyle: CSSProperties = {
    ...abs({
      left: "9.5%",
      top: "27.2%",
      width: "81.3%",
      aspectRatio: "1016 / 1215",
    }),
  };

  return (
    <article
      className="relative flex min-h-0 w-full justify-center overflow-hidden"
      style={{
        backgroundColor: "#e9e1dc",
        backgroundImage: `url("${LOVE_ASSETS.texture}")`,
        backgroundRepeat: "repeat",
      }}
    >
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

      <div style={stageStyle}>
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

        <div style={polaroidStyle}>
          <button
            type="button"
            onClick={choosePhoto}
            aria-label="Add your photo"
            className="absolute z-[1] block overflow-hidden bg-black p-0"
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
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span
                className="absolute inset-0 grid place-items-center text-center text-white"
                style={{
                  fontFamily: '"Oswald", "Arial Narrow", sans-serif',
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
            className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-fill"
            style={{
              filter: "drop-shadow(0 .6cqw 1.4cqw rgba(60,10,15,.3))",
            }}
          />
        </div>

        <img
          src={LOVE_ASSETS.cats}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute z-[4] h-auto"
          style={{
            left: "49.2%",
            top: "4.9%",
            width: "47%",
            filter: "drop-shadow(0 .4cqw .6cqw rgba(60,30,30,.22))",
          }}
        />

        <img
          src={LOVE_ASSETS.love}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute z-[4] h-auto"
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
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute z-[4] h-auto"
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
          aria-label={`${years} yers with you`}
        >
          <div
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) => onYearsChange?.(event.currentTarget.innerText)}
            className="select-text leading-[.9] outline-none"
            style={{
              fontFamily: '"Anton", "Impact", "Arial Narrow", sans-serif',
              fontWeight: 400,
              fontSize: "14.5cqw",
              lineHeight: ".9",
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
            className="mb-[1.2cqw] ml-[-.2cqw] select-text whitespace-nowrap outline-none"
            style={{
              fontFamily: '"Anton", "Impact", "Arial Narrow", sans-serif',
              fontWeight: 400,
              fontSize: "4.7cqw",
              lineHeight: 1,
              letterSpacing: "-.02em",
              wordSpacing: ".35em",
              WebkitTextStroke: ".15cqw #fff",
              filter: `url(#${filterId}light)`,
            }}
          >
            {yearsLabel}
          </div>
        </div>

        <div
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
              fontFamily: '"Caveat Brush", "Amatic SC", "Arial Narrow", sans-serif',
              fontWeight: 400,
              color: "#14110f",
              fontSize: "4.6cqw",
              lineHeight: 1.22,
              letterSpacing: ".08em",
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
          className="pointer-events-none absolute z-[5] h-auto"
          style={{
            left: "44.6%",
            top: "72.2%",
            width: "37.5%",
            filter: "drop-shadow(0 .3cqw .4cqw rgba(60,40,20,.25))",
          }}
        />
      </div>
    </article>
  );
}
