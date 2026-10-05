"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type HTMLAttributes,
} from "react";

export const BIRTHDAY_DEFAULT_MESSAGE = [
  "happy birthday !!",
  "to my favorite person,",
  "the one who always makes",
  "my heart feel safe and happy.",
  "thank you for staying,",
  "for understanding me, and",
  "for loving me with all your heart.",
  "i’m beyond grateful to have you",
  "in my life. i love you, and i hope",
  "this year brings you more joy,",
  "more strength, and everything",
  "you’ve been praying for.",
  "happy birthday, my love.",
  "<33",
].join("\n");

interface BirthdayTemplateProps {
  heading?: string;
  message?: string;
  photoUrl?: string | null;
  editable?: boolean;
  onHeadingChange?: (value: string) => void;
  onMessageChange?: (value: string) => void;
  onPhotoChange?: (file: File | undefined) => void;
}

function PaperTexture() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.26]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 12% 18%, rgba(50,42,25,.11) 0 .7px, transparent .9px), radial-gradient(circle at 74% 62%, rgba(50,42,25,.08) 0 .65px, transparent .9px), radial-gradient(circle at 35% 88%, rgba(255,255,255,.3) 0 1px, transparent 1.2px)",
        backgroundSize: "9px 9px, 13px 13px, 17px 17px",
        mixBlendMode: "multiply",
      }}
    />
  );
}

function Tape() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-[-4%] top-[-2.5%] h-[9vw] max-h-20 w-[18vw] max-w-40 rotate-[-18deg] opacity-55"
      style={{
        background:
          "linear-gradient(90deg, rgba(219,216,204,.68), rgba(195,192,182,.55), rgba(226,223,211,.7))",
        boxShadow: "0 1px 5px rgba(0,0,0,.03)",
      }}
    />
  );
}

const Handwritten = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Handwritten({ children, className = "", style, ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        className={className}
        style={{
          fontFamily: '"Patrick Hand", "Comic Sans MS", cursive',
          fontWeight: 400,
          color: "#073b91",
          ...style,
        }}
      >
        {children}
      </div>
    );
  },
);

export function BirthdayTemplate({
  heading = "★ HAPPY BIRTHDAY !!",
  message = BIRTHDAY_DEFAULT_MESSAGE,
  photoUrl = null,
  editable = false,
  onHeadingChange,
  onMessageChange,
  onPhotoChange,
}: BirthdayTemplateProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.activeElement !== headingRef.current && headingRef.current) {
      headingRef.current.innerText = heading;
    }
  }, [heading]);

  useEffect(() => {
    if (document.activeElement !== messageRef.current && messageRef.current) {
      messageRef.current.innerText = message;
    }
  }, [message]);

  const choosePhoto = () => {
    if (editable) inputRef.current?.click();
  };

  return (
    <article
      className="relative min-h-full w-full overflow-x-hidden"
      style={{
        background: "#efede2",
      }}
    >
      <PaperTexture />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onPhotoChange?.(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <div className="relative mx-auto w-full max-w-[760px] px-[6.5vw] pb-28 pt-[5vw] sm:px-16 sm:pb-36 sm:pt-16">
        <Handwritten
          ref={headingRef}
          contentEditable={editable}
          suppressContentEditableWarning
          onInput={(event) =>
            onHeadingChange?.(event.currentTarget.innerText)
          }
          className="ml-auto w-max max-w-full select-text text-right outline-none"
          style={{
            transform: "rotate(5deg)",
            fontSize: "clamp(1.55rem, 5vw, 3.7rem)",
            fontFamily: '"Gochi Hand", "Patrick Hand", cursive',
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 0.94,
          }}
          title={editable ? "Double-click to edit" : undefined}
        >
          {heading}
        </Handwritten>

        <section className="relative mt-[10vw] sm:mt-24">
          <Tape />

          <button
            type="button"
            onClick={choosePhoto}
            className="group relative block w-full overflow-hidden rounded-[1.1rem] text-left"
            style={{
              aspectRatio: "1.64 / 1",
              background:
                "radial-gradient(circle at 30% 22%, rgba(255,255,255,.085), transparent 34%), radial-gradient(circle at 76% 74%, rgba(255,255,255,.06), transparent 38%), #2a2a2a",
              boxShadow:
                "0 20px 50px rgba(0,0,0,.08), inset 0 0 0 1px rgba(255,255,255,.05)",
              cursor: editable ? "pointer" : "default",
            }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.26]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 30%, #fff 0 .7px, transparent .8px), radial-gradient(circle at 72% 68%, #fff 0 .65px, transparent .75px)",
                backgroundSize: "7px 7px, 11px 11px",
                mixBlendMode: "screen",
              }}
            />

            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                <span className="text-[clamp(2.2rem,7vw,4.5rem)] font-light leading-none">
                  +
                </span>
                <span className="mt-2 font-serif text-[clamp(1.25rem,3.3vw,2.45rem)] tracking-[-0.04em]">
                  Add your photo
                </span>
                {editable && (
                  <span className="mt-2 rounded-full bg-white/10 px-10 py-4 font-sans text-[10px] tracking-[.08em] text-white/55">
                    PHOTO #1
                  </span>
                )}
              </span>
            )}

            <span
              aria-hidden="true"
              className="absolute inset-0 bg-white/0 transition-colors duration-500 group-hover:bg-white/[0.035]"
            />
          </button>
        </section>

        <section className="relative mt-[7vw] sm:mt-16">
          <Handwritten
            ref={messageRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) =>
              onMessageChange?.(event.currentTarget.innerText)
            }
            className="select-text whitespace-pre-line text-center outline-none"
            style={{
              fontFamily: '"Patrick Hand", "Comic Sans MS", cursive',
              fontWeight: 400,
              fontSize: "clamp(1rem, 2.55vw, 1.7rem)",
              letterSpacing: "0.005em",
              lineHeight: 1.47,
            }}
            title={editable ? "Double-click to edit" : undefined}
          >
            {message}
          </Handwritten>

          <Handwritten
            aria-hidden="true"
            className="absolute left-0 top-[34%] hidden select-none sm:block"
            style={{
              transform: "rotate(-8deg)",
              fontSize: "clamp(1.5rem, 3.2vw, 2.4rem)",
            }}
          >
            ★
          </Handwritten>

          <Handwritten
            aria-hidden="true"
            className="absolute right-[2%] top-[4%] select-none"
            style={{
              transform: "rotate(8deg)",
              fontSize: "clamp(1.1rem, 3vw, 2rem)",
            }}
          >
            ✦
          </Handwritten>
        </section>
      </div>
    </article>
  );
}
