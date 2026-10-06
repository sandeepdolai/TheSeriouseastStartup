"use client";

import { forwardRef, useEffect, useRef, type HTMLAttributes } from "react";

const ASSET_BASE =
  "https://raw.githubusercontent.com/sandeepdolai/templateassets/main/";

const LOVE_ASSETS = {
  cats: ASSET_BASE + "file_00000000db28820b8ba26950672162f5.png",
  tag: ASSET_BASE + "3229e85812cd42b0a87630ac580b562d.png",
  hearts: ASSET_BASE + "204e765506cf4c2d7b789922b4b0ccf8.png",
};

export const LOVE_DEFAULT_MESSAGE = [
  '"I JUST WANT TO TELL YOU, THANK YOU FOR COMING',
  'INTO MY LIFE. YOU ACTUALLY MAKE ME SMILE AND',
  'LAUGH. THANK YOU FOR BEING UNDERSTANDING. THANK',
  'YOU FOR BEING MY BIGGEST SUPPORTER, AND THANK YOU',
  'FOR CARING ABOUT ME. I REALLY APPRECIATE YOU SO',
  'MUCH. I LOVE YOU A LOT!"',
].join("\n");

interface LoveLifeTemplateProps {
  heading?: string;
  years?: string;
  yearsLabel?: string;
  sideNote?: string;
  message?: string;
  photoUrl?: string | null;
  editable?: boolean;
  onYearsChange?: (value: string) => void;
  onYearsLabelChange?: (value: string) => void;
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
          fontFamily: '"Dancing Script", cursive',
          fontWeight: 500,
          color: "#8d252a",
          ...style,
        }}
      >
        {children}
      </div>
    );
  },
);

export function LoveLifeTemplate({
  heading = "Love of my life",
  years = "2",
  yearsLabel = "years with you",
  sideNote = "favorite person",
  message = LOVE_DEFAULT_MESSAGE,
  photoUrl = null,
  editable = false,
  onYearsChange,
  onYearsLabelChange,
  onMessageChange,
  onPhotoChange,
}: LoveLifeTemplateProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const yearsRef = useRef<HTMLDivElement>(null);
  const yearsLabelRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

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
    if (messageRef.current && document.activeElement !== messageRef.current) {
      messageRef.current.innerText = message;
    }
  }, [message]);

  const choosePhoto = () => {
    if (editable) photoInputRef.current?.click();
  };

  return (
    <article className="relative w-full overflow-hidden bg-[#eee7e3]">
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
        className="relative mx-auto w-full max-w-[864px] overflow-hidden"
        style={{
          aspectRatio: "864 / 1536",
          background: "#eee7e3",
        }}
      >
        <img
          src={LOVE_ASSETS.hearts}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />

        <Handwritten
          className="absolute left-[4%] top-[14.5%] z-30 w-[38%] select-none leading-[.78]"
          style={{
            fontSize: "clamp(2.5rem, 6.1vw, 5.6rem)",
            transform: "rotate(-9deg)",
          }}
        >
          {heading}
        </Handwritten>

        <img
          src={LOVE_ASSETS.cats}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[0.5%] top-[4%] z-30 h-auto w-[39%] object-contain"
        />

        <section className="absolute left-[9.5%] top-[27.2%] z-20 w-[81.1%]">
          <div className="relative aspect-[700/853] rounded-[1px] bg-[#7c1b27] shadow-[0_10px_22px_rgba(43,16,20,.07)]">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 17% 22%, rgba(255,255,255,.16) 0 1px, transparent 1.4px), radial-gradient(circle at 73% 64%, rgba(30,0,0,.18) 0 .9px, transparent 1.3px)",
                backgroundSize: "11px 11px, 15px 15px",
                mixBlendMode: "soft-light",
              }}
            />

            <button
              type="button"
              onClick={choosePhoto}
              className="absolute left-[5.7%] top-[5.8%] z-10 block aspect-square w-[88.3%] overflow-hidden bg-black"
              style={{ cursor: editable ? "pointer" : "default" }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                  <span className="text-[clamp(2rem,5vw,4.5rem)] font-light leading-none">
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

            <div className="absolute bottom-[7.4%] left-[4.5%] z-30 flex items-end text-white">
              <Handwritten
                ref={yearsRef}
                contentEditable={editable}
                suppressContentEditableWarning
                onInput={(event) =>
                  onYearsChange?.(event.currentTarget.innerText)
                }
                className="select-text leading-[.72] outline-none"
                style={{
                  color: "#fff",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(5rem, 9vw, 8.6rem)",
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
                className="mb-[.25rem] ml-[.7rem] select-text whitespace-nowrap outline-none"
                style={{
                  color: "#fff",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(1.15rem, 2.55vw, 2.3rem)",
                }}
              >
                {yearsLabel}
              </Handwritten>
            </div>
          </div>

          <Handwritten
            aria-hidden="true"
            className="absolute right-[-10%] top-[24%] z-40 w-[18%] select-none text-center leading-[.92]"
            style={{
              fontSize: "clamp(1.25rem, 3.4vw, 3rem)",
              transform: "rotate(82deg)",
            }}
          >
            {sideNote}
          </Handwritten>
        </section>

        <section className="absolute left-[31.5%] top-[76.2%] z-50 w-[55%]">
          <div className="relative aspect-[3229/1900]">
            <img
              src={LOVE_ASSETS.tag}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />
            <div className="absolute inset-[21%_10%_11%] flex items-center justify-center">
              <div
                ref={messageRef}
                contentEditable={editable}
                suppressContentEditableWarning
                onInput={(event) =>
                  onMessageChange?.(event.currentTarget.innerText)
                }
                className="select-text whitespace-pre-line text-center outline-none"
                style={{
                  fontFamily: '"Oswald", "Arial Narrow", sans-serif',
                  fontWeight: 700,
                  color: "#171112",
                  fontSize: "clamp(.62rem, 1.55vw, 1.3rem)",
                  lineHeight: 1.2,
                  letterSpacing: ".012em",
                }}
              >
                {message}
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
