"use client";

import React, { useEffect, useRef, useState } from "react";
import { ease, tween } from "@/gl/react";

interface OverlayProps {
  open: boolean;
  onEntered?: () => void;
  onExited?: () => void;
}

function useReveal(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parts = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    let cancelled = false;
    const timers: number[] = [];

    if (open) {
      setVisible(true);
      setShown(true);

      parts.forEach((p, i) => {
        const base = parseFloat(p.dataset.delay || "0");
        p.style.opacity = "0";
        p.style.transform = "translateY(0.8rem)";
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            tween(0, 1, 0.7, ease.expoOut, (v) => {
              p.style.opacity = String(v);
              p.style.transform = `translateY(${(1 - v) * 0.8}rem)`;
            }, undefined);
          }, base * 1000 + i * 35)
        );
      });
    } else if (shown || visible) {
      setShown(false);

      parts
        .slice()
        .reverse()
        .forEach((p, i) => {
          const startOpacity = parseFloat(p.style.opacity || "1");
          timers.push(
            window.setTimeout(() => {
              if (cancelled) return;
              tween(startOpacity, 0, 0.32, ease.expoOut, (v) => {
                p.style.opacity = String(v);
                p.style.transform = `translateY(${(1 - v) * 0.55}rem)`;
              }, undefined);
            }, i * 22)
          );
        });

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setVisible(false);
        }, 390)
      );
    }

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [open, shown, visible]);

  return { ref, visible };
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.7-3.2 3-5 6.5-5s5.8 1.8 6.5 5" strokeLinecap="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" strokeLinejoin="round" />
      <path d="M19 16v6M16 19h6" strokeLinecap="round" />
    </svg>
  );
}

function ProfileAction({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto flex h-52 w-full items-center justify-center gap-10 rounded-full border border-white/12 px-20 text-white transition-all duration-300 ease-out hover:border-white/25 hover:bg-white/[0.06] active:scale-[0.99]"
    >
      {icon}
      <span className="text-14 tracking-[-0.02em]">{children}</span>
    </button>
  );
}

export function ProfileOverlay({
  open,
  onMyProjects,
  onMyTemplates,
}: OverlayProps & {
  onMyProjects?: () => void;
  onMyTemplates?: () => void;
}) {
  const { ref, visible } = useReveal(open);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-15 s:px-25"
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <div
        data-reveal
        className="pointer-events-auto w-full max-w-[30rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#151515]/95 text-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between px-25 pb-18 pt-25 s:px-30 s:pb-20 s:pt-30">
          <div className="min-w-0">
            <p className="label opacity-55">PAPER STISH</p>
            <h2 className="mt-7 truncate text-20 leading-20 tracking-[-0.04em]">Your account</h2>
          </div>
          <div className="flex size-40 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
            <UserIcon />
          </div>
        </div>

        <div className="px-15 pb-15 s:px-20 s:pb-20">
          <div data-reveal className="rounded-[1.55rem] bg-[#272727] p-20 s:p-25">
            <div className="flex items-start gap-12">
              <div className="flex size-38 shrink-0 items-center justify-center rounded-full bg-white text-black">
                <SparkIcon />
              </div>
              <div className="min-w-0">
                <p className="text-15 leading-17 tracking-[-0.02em]">Free</p>
                <p className="mt-5 text-12 leading-15 tracking-[-0.01em] text-white/50">
                  Upgrade to unlock the full Paper Stish experience.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="pointer-events-auto mt-18 h-48 w-full rounded-full bg-white text-black text-14 tracking-[-0.02em] transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
            >
              Upgrade
            </button>
          </div>

          <div data-reveal className="mt-10 flex flex-col gap-8">
            <ProfileAction icon={<UserIcon />} onClick={onMyProjects}>My Projects</ProfileAction>
            <ProfileAction onClick={onMyTemplates}>My Templates</ProfileAction>
            <ProfileAction>Manage subscription</ProfileAction>
          </div>

          <div data-reveal className="mt-15 border-t border-white/10 pt-15 text-center">
            <button
              type="button"
              className="pointer-events-auto text-12 tracking-[-0.01em] text-white/45 transition-colors duration-300 hover:text-white/80"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="px-25 pb-22 text-center s:px-30 s:pb-25">
          <p className="label opacity-35 mb-8">Privacy • Terms Of Service • Support</p>
          <p className="text-10 font-medium tracking-[-0.01em] text-white/35">
            Making someone else happy is one of the best feelings.
          </p>
        </div>
      </div>
    </div>
  );
}

export function NewsletterOverlay({ open }: OverlayProps) {
  const { ref, visible } = useReveal(open);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("Enter a valid email address");
      return;
    }
    setBusy(true);
    setStatus("Subscribing…");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.message || "Subscribed");
        setEmail("");
      } else {
        setStatus(data.error || "Something went wrong");
      }
    } catch {
      setStatus("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed left-1/2 top-1/2 z-40 w-420 -translate-x-1/2 -translate-y-1/2 s:w-600"
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <div className="absolute inset-x-20 top-1/2 flex -translate-y-1/2 flex-col items-center text-center text-white">
        <p data-reveal className="text-14 leading-14 tracking-[-0.02em] max-w-[30rem] s:max-w-[32.5rem]">
          An occasional newsletter with insights and thoughts from a design engineer, drawn from over a decade of freelancing.
        </p>
        <form data-reveal onSubmit={submit} className="mt-25 s:mt-30 flex w-full max-w-[26rem] s:max-w-[32rem] items-center gap-x-8" noValidate>
          <div className="relative flex h-40 s:h-45 w-full items-center rounded-full bg-black px-20 text-14 tracking-[-0.02em] min-w-0 flex-1">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              aria-label="Email address"
              placeholder="Email address"
              className="pointer-events-auto h-full w-full border-0 bg-transparent text-white outline-none [font:inherit] [letter-spacing:inherit] placeholder:text-white/40"
            />
          </div>
          <button
            type="submit"
            aria-label="Subscribe"
            disabled={busy}
            className="pointer-events-auto size-40 s:size-45 flex-none rounded-full bg-white text-black flex items-center justify-center transition-transform duration-300 hover:scale-105 disabled:opacity-70"
          >
            <svg viewBox="0 0 24 24" className="size-15" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        </form>
        <p data-reveal role="status" aria-live="polite" className="label mt-15 min-h-[1.2em] w-full text-center">
          <span className="inline-block opacity-60">{status}</span>
        </p>
      </div>
    </div>
  );
}
