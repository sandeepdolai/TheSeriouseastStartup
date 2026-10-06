"use client";

import { forwardRef, useEffect, useRef, type HTMLAttributes } from "react";

const ASSET_BASE =
  "https://raw.githubusercontent.com/sandeepdolai/templateassets/main/";

const LOVE_ASSETS = {
  background: ASSET_BASE + "ec6103999a9a1153cab168e028555b63.png",
  cats: ASSET_BASE + "file_00000000db28820b8ba26950672162f5.png",
  frame: ASSET_BASE + "a4061d3351e63fe0fe177d547bd349c0.png",
  tag: ASSET_BASE + "3229e85812cd42b0a87630ac580b562d.png",
  hearts: ASSET_BASE + "204e765506cf4c2d7b789922b4b0ccf8.png",
};

export const LOVE_DEFAULT_MESSAGE = [
  '“I JUST WANT TO TELL YOU, THANK YOU FOR COMING',
  'INTO MY LIFE. YOU ACTUALLY MAKE ME SMILE AND',
  'LAUGH. THANK YOU FOR BEING UNDERSTANDING. THANK',
  'YOU FOR BEING MY BIGGEST SUPPORTER, AND THANK YOU',
  'FOR CARING ABOUT ME. I REALLY APPRECIATE YOU SO',
  'MUCH. I LOVE YOU A LOT!”',
].join("\n");

interface LoveLifeTemplateProps {
  heading?: string;
  years?: string;
  yearsLabel?: string;
  sideNote?: string;
  message?: string;
  photoUrl?: string | null;
  editable?: boolean;
  onHeadingChange?: (value: string) => void;
  onYearsChange?: (value: string) => void;
  onYearsLabelChange?: (value: string) => void;
  onSideNoteChange?: (value: string) => void;
  onMessageChange?: (value: string) => void;
  onPhotoChange?: (file: File | undefined) => void;
}

const Handwritten = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Handwritten({ children, className = "", style, ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        className={className}
        style={{
          fontFamily: '"Dancing Script", "Gochi Hand", cursive',
          fontWeight: 600,
          color: "#8f2428",
          ...style,
        }}
      >
        {children}
      </div>
    );
  },
);

function PaperTexture() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-multiply"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 18%, rgba(76,48,45,.13) 0 1px, transparent 1.4px), radial-gradient(circle at 72% 64%, rgba(76,48,45,.08) 0 .8px, transparent 1.2px)',
        backgroundSize: "13px 13px, 17px 17px",
      }}
    />
  );
}

export function LoveLifeTemplate({
  heading = "Love of my life",
  years = "2",
  yearsLabel = "years with you",
  sideNote = "favorite person",
  message = LOVE_DEFAULT_MESSAGE,
  photoUrl = null,
  editable = false,
  onHeadingChange,
  onYearsChange,
  onYearsLabelChange,
  onSideNoteChange,
  onMessageChange,
  onPhotoChange,
}: LoveLifeTemplateProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const yearsRef = useRef<HTMLDivElement>(null);
  const yearsLabelRef = useRef<HTMLDivElement>(null);
  const sideNoteRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headingRef.current && document.activeElement !== headingRef.current) {
      headingRef.current.innerText = heading;
    }
  }, [heading]);

  useEffect(() => {
    if (yearsRef.current && document.activeElement !== yearsRef.current) {
      yearsRef.current.innerText = years;
    }
  }, [years]);

  useEffect(() => {
    if (
      yearsLabelRef.current &&
      document.activeElement !== yearsLabelRef.current
    ) {
      yearsLabelRef.current.innerText = yearsLabel;
    }
  }, [yearsLabel]);

  useEffect(() => {
    if (sideNoteRef.current && document.activeElement !== sideNoteRef.current) {
      sideNoteRef.current.innerText = sideNote;
    }
  }, [sideNote]);

  useEffect(() => {
    if (messageRef.current && document.activeElement !== messageRef.current) {
      messageRef.current.innerText = message;
    }
  }, [message]);

  const choosePhoto = () => {
    if (editable) photoInputRef.current?.click();
  };

  return (
    <article className="relative min-h-screen w-full overflow-hidden bg-[#eee5e1] text-[#27181a]">
      <PaperTexture />

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

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage: `url(${LOVE_ASSETS.background})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          mixBlendMode: "multiply",
        }}
      />

      <main className="relative mx-auto min-h-screen w-full max-w-[1180px] px-[5vw] pb-[8vh] pt-[5vh] sm:px-12 lg:px-16">
        <header className="relative min-h-[13vh]">
          <Handwritten
            ref={headingRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) => onHeadingChange?.(event.currentTarget.innerText)}
            className="max-w-[58%] select-text leading-[.86] outline-none"
            style={{
              fontSize: "clamp(3.1rem, 6vw, 6.6rem)",
              transform: "rotate(-8deg)",
              transformOrigin: "left top",
            }}
          >
            {heading}
          </Handwritten>

          <img
            src={LOVE_ASSETS.cats}
            alt=""
            aria-hidden={!editable}
            className="pointer-events-none absolute right-[-1%] top-[-2vh] z-10 h-auto w-[52%] max-w-[560px] object-contain sm:right-[0%] sm:w-[48%]"
          />

          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.28),transparent_35%)]"
          />
        </header>

        <section className="relative mx-auto mt-[3vh] w-full max-w-[850px]">
          <div className="relative">
            <img
              src={LOVE_ASSETS.frame}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />

            <button
              type="button"
              onClick={choosePhoto}
              className="relative mx-auto block aspect-square w-[73%] overflow-hidden bg-black/95"
              style={{
                marginTop: "8%",
                boxShadow: "0 0 0 1px rgba(25,12,15,.04)",
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
                <span className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                  <span className="text-[clamp(2.2rem,5vw,4.5rem)] font-light leading-none">
                    +
                  </span>
                  <span className="mt-2 font-serif text-[clamp(1.1rem,2.4vw,2rem)]">
                    Add your photo
                  </span>
                  {editable && (
                    <span className="mt-3 rounded-full bg-white/10 px-10 py-4 font-sans text-[10px] tracking-[.1em] text-white/55">
                      PHOTO #1
                    </span>
                  )}
                </span>
              )}
            </button>

            <Handwritten
              ref={sideNoteRef}
              contentEditable={editable}
              suppressContentEditableWarning
              onInput={(event) =>
                onSideNoteChange?.(event.currentTarget.innerText)
              }
              className="absolute right-[-5%] top-[36%] z-20 w-[15%] text-center select-text leading-[.95] outline-none"
              style={{
                fontSize: "clamp(1.5rem, 3.8vw, 3.4rem)",
                transform: "rotate(82deg)",
              }}
            >
              {sideNote}
            </Handwritten>

            <img
              src={LOVE_ASSETS.hearts}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-85"
            />

            <div className="relative flex items-end justify-between px-[6%] pb-[3%] pt-[-2%]">
              <div className="flex items-end gap-2 text-white">
                <Handwritten
                  ref={yearsRef}
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onInput={(event) =>
                    onYearsChange?.(event.currentTarget.innerText)
                  }
                  className="select-text font-sans font-black leading-none outline-none"
                  style={{
                    color: "#fff",
                    fontFamily: "sans-serif",
                    fontWeight: 900,
                    fontSize: "clamp(4rem, 7vw, 8rem)",
                  }}
                >
                  {years}
                </Handwritten>
                <Handwritten
                  ref={yearsLabelRef}
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onInput={(event) =>
                    onYearsLabelChange?.(event.currentTarget.innerText)
                  }
                  className="mb-[.55rem] select-text whitespace-nowrap outline-none"
                  style={{
                    color: "#fff",
                    fontFamily: "sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(1.25rem, 2.8vw, 2.6rem)",
                    transform: "translateX(-.2rem)",
                  }}
                >
                  {yearsLabel}
                </Handwritten>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto mt-[-2vh] w-[78%] max-w-[700px] sm:w-[72%]">
          <img
            src={LOVE_ASSETS.tag}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          />
          <div className="relative px-[12%] py-[15%]">
            <div
              ref={messageRef}
              contentEditable={editable}
              suppressContentEditableWarning
              onInput={(event) => onMessageChange?.(event.currentTarget.innerText)}
              className="select-text whitespace-pre-line text-center outline-none"
              style={{
                fontFamily: '"Oswald", "Arial Narrow", sans-serif',
                fontWeight: 700,
                color: "#171112",
                fontSize: "clamp(.8rem, 1.55vw, 1.35rem)",
                lineHeight: 1.28,
                letterSpacing: ".02em",
              }}
            >
              {message}
            </div>
          </div>
        </section>

        <div className="pb-4" />
      </main>
    </article>
  );
}
