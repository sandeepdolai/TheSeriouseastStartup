"use client";

import { useRef } from "react";

interface BirthdayTemplateProps {
  photoUrl?: string | null;
  editable?: boolean;
  recipientName?: string;
  message?: string;
  onRecipientNameChange?: (value: string) => void;
  onMessageChange?: (value: string) => void;
  onPhotoChange?: (file: File | undefined) => void;
}

const MESSAGE =
  "happy birthday !!\n" +
  "to my favorite person,\n" +
  "the one who always makes\n" +
  "my heart feel safe and happy.\n" +
  "thank you for staying,\n" +
  "for understanding me, and\n" +
  "for loving me with all your heart.\n" +
  "i’m beyond grateful to have you\n" +
  "in my life. i love you, and i hope\n" +
  "this year brings you more joy,\n" +
  "more strength, and everything\n" +
  "you’ve been praying for.\n" +
  "happy birthday, my love.\n" +
  "<33";

export function BirthdayTemplate({
  photoUrl = null,
  editable = false,
  recipientName,
  message,
  onMessageChange,
  onPhotoChange,
}: BirthdayTemplateProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPhotoPicker = () => {
    if (!editable) return;
    inputRef.current?.click();
  };

  const renderedMessage =
    message || (recipientName
      ? `happy birthday, ${recipientName} !!\\n${MESSAGE.replace("happy birthday !!\\n", "")}`
      : MESSAGE);

  return (
    <main
      className="birthday-template relative min-h-[100svh] w-full overflow-y-auto"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(255,255,255,.55), transparent 28%), linear-gradient(180deg, #f1f0e5 0%, #ebe9dc 100%)",
        color: "#073a91",
      }}
    >
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

      <div className="mx-auto flex min-h-[100svh] w-full max-w-[56rem] flex-col px-[7vw] pb-16 pt-[4.5vw] sm:px-16 sm:pb-20 sm:pt-14">
        <div
          className="relative self-end select-none"
          style={{
            transform: "rotate(5deg)",
            fontFamily:
              '"Comic Sans MS", "Bradley Hand", "Segoe Print", cursive',
            fontWeight: 700,
            fontSize: "clamp(1.4rem, 4.3vw, 3.2rem)",
            letterSpacing: "-0.055em",
            lineHeight: 0.95,
          }}
        >
          <span className="mr-2 inline-block" aria-hidden="true">
            ★
          </span>
          HAPPY BIRTHDAY !!
        </div>

        <section className="relative mt-[10vw] sm:mt-20">
          <div
            className="absolute -left-[4.4vw] top-[-2vw] h-[5vw] w-[15vw] max-w-[9rem] -rotate-[18deg] opacity-50"
            style={{
              background:
                "linear-gradient(90deg, rgba(223,220,208,.72), rgba(201,198,187,.55), rgba(226,223,211,.7))",
              filter: "blur(.15px)",
            }}
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={openPhotoPicker}
            className="group relative block w-full overflow-hidden rounded-[1.05rem] text-left"
            style={{
              aspectRatio: "1.08 / 0.72",
              background:
                "radial-gradient(circle at 30% 20%, rgba(255,255,255,.08), transparent 35%), radial-gradient(circle at 80% 75%, rgba(255,255,255,.06), transparent 38%), #2a2a2a",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,.05), 0 18px 40px rgba(0,0,0,.08)",
              cursor: editable ? "pointer" : "default",
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.24]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 30%, #fff 0 0.7px, transparent 0.8px), radial-gradient(circle at 72% 68%, #fff 0 0.65px, transparent 0.75px)",
                backgroundSize: "7px 7px, 11px 11px",
                mixBlendMode: "screen",
              }}
              aria-hidden="true"
            />

            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                <span className="text-[clamp(2.2rem,6vw,4rem)] font-light leading-none">
                  +
                </span>
                <span
                  className="mt-1.5 font-serif text-[clamp(1.45rem,3.5vw,2.55rem)] tracking-[-0.04em]"
                >
                  Add your photo
                </span>
              </div>
            )}

            <span
              className="absolute inset-0 bg-white/0 transition-colors duration-500 group-hover:bg-white/[0.035]"
              aria-hidden="true"
            />
          </button>
        </section>

        <section className="relative mt-[7vw] flex-1 pb-8 sm:mt-14">
          <span
            className="absolute -left-1 top-[42%] hidden text-[clamp(1.5rem,3.6vw,2.5rem)] sm:block"
            style={{
              transform: "rotate(-8deg)",
              fontFamily:
                '"Comic Sans MS", "Bradley Hand", "Segoe Print", cursive',
            }}
            aria-hidden="true"
          >
            ★
          </span>

          <span
            className="absolute right-[3%] top-[11%] text-[clamp(1.1rem,3vw,2rem)]"
            style={{
              transform: "rotate(8deg)",
              fontFamily:
                '"Comic Sans MS", "Bradley Hand", "Segoe Print", cursive',
            }}
            aria-hidden="true"
          >
            ✦
          </span>

          <p
            contentEditable={editable}
            suppressContentEditableWarning
            onInput={(event) => {
              onMessageChange?.(event.currentTarget.innerText);
            }}
            className="whitespace-pre-line text-center outline-none"
            style={{
              fontFamily:
                '"Comic Sans MS", "Bradley Hand", "Segoe Print", cursive',
              fontWeight: 700,
              fontSize: "clamp(1rem, 2.25vw, 1.7rem)",
              letterSpacing: "-0.045em",
              lineHeight: 1.45,
              textWrap: "balance",
            }}
          >
            {renderedMessage}
          </p>
        </section>
      </div>
    </main>
  );
}
