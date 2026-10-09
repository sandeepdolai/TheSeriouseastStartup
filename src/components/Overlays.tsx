"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { ease, tween } from "@/gl/react";
import { isAdminEmail } from "@/lib/admin";

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
  onSmartEdit,
  onAdminTemplates,
}: OverlayProps & {
  onMyProjects?: () => void;
  onMyTemplates?: () => void;
  onSmartEdit?: () => void;
  onAdminTemplates?: () => void;
}) {
  const { ref, visible } = useReveal(open);
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && !!session?.user;

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
          <div data-reveal className="mb-10">
            <ProfileAction
              icon={<SparkIcon />}
              onClick={() => window.location.assign("/website-templates")}
            >
              Website Templates
            </ProfileAction>
          </div>
          {!signedIn ? (
            <div data-reveal className="rounded-[1.55rem] bg-[#272727] p-20 s:p-25">
              <div className="flex items-start gap-12">
                <div className="flex size-38 shrink-0 items-center justify-center rounded-full bg-white text-black">
                  <svg viewBox="0 0 24 24" className="size-17" aria-hidden="true">
                    <path d="M21.35 12.27c0-.77-.07-1.51-.21-2.23H12v4.22h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.91-4.17 2.91-7.37Z" fill="#4285F4"/>
                    <path d="M12 22c2.7 0 4.97-.89 6.63-2.41l-3.14-2.44c-.87.58-1.97.92-3.49.92-2.68 0-4.95-1.81-5.77-4.24H3v2.51A10 10 0 0 0 12 22Z" fill="#34A853"/>
                    <path d="M6.23 13.83A6 6 0 0 1 5.91 12c0-.64.11-1.26.32-1.83V7.66H3a10 10 0 0 0 0 8.68l3.23-2.51Z" fill="#FBBC05"/>
                    <path d="M12 5.93c1.47 0 2.8.51 3.84 1.52l2.88-2.88C16.96 2.99 14.7 2 12 2a10 10 0 0 0-9 5.66l3.23 2.51C7.05 7.74 9.32 5.93 12 5.93Z" fill="#EA4335"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-15 leading-17 tracking-[-0.02em]">Sign in with Google</p>
                  <p className="mt-5 text-12 leading-15 tracking-[-0.01em] text-white/50">
                    Save your projects to your Paper Stish account.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signIn("google")}
                className="pointer-events-auto mt-18 flex h-48 w-full items-center justify-center gap-9 rounded-full bg-white text-black text-14 tracking-[-0.02em] transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
              >
                Continue with Google
              </button>
            </div>
          ) : (
            <>
              <div data-reveal className="rounded-[1.55rem] bg-[#272727] p-20 s:p-25">
                <div className="flex items-center gap-12">
                  <div className="size-38 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {session.user?.image ? (
                      <img src={session.user.image} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center"><UserIcon /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-15 leading-17 tracking-[-0.02em]">
                      {session.user?.name ?? "Paper Stish user"}
                    </p>
                    <p className="mt-5 truncate text-12 leading-15 tracking-[-0.01em] text-white/50">
                      {session.user?.email ?? ""}
                    </p>
                  </div>
                </div>
              </div>

              <div data-reveal className="mt-10 flex flex-col gap-8">
                <ProfileAction icon={<SparkIcon />} onClick={onSmartEdit}>Smart Edit</ProfileAction>
                {isAdminEmail(session.user?.email) && (
                  <ProfileAction icon={<SparkIcon />} onClick={onAdminTemplates}>Admin Templates</ProfileAction>
                )}
                <ProfileAction icon={<UserIcon />} onClick={onMyProjects}>My Projects</ProfileAction>
              </div>

              <div data-reveal className="mt-15 border-t border-white/10 pt-15 text-center">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="pointer-events-auto text-12 tracking-[-0.01em] text-white/45 transition-colors duration-300 hover:text-white/80"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

        <div className="px-25 pb-22 text-center s:px-30 s:pb-25">
          <nav aria-label="Legal and support" className="label mb-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-6 text-white/45">
            <a href="/privacy" className="transition-opacity hover:text-white">Privacy</a>
            <span aria-hidden="true">•</span>
            <a href="/terms" className="transition-opacity hover:text-white">Terms</a>
            <span aria-hidden="true">•</span>
            <a href="mailto:sandeepdolai.info@gmail.com" className="transition-opacity hover:text-white">Support</a>
          </nav>
          <p className="text-10 font-medium tracking-[-0.01em] text-white/35">
            Making something personal should feel simple.
          </p>
        </div>
      </div>
    </div>
  );
}

export function NewsletterOverlay({ open }: OverlayProps) {
  const { ref, visible } = useReveal(open);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed left-1/2 top-1/2 z-40 w-420 -translate-x-1/2 -translate-y-1/2 s:w-600"
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <div className="absolute inset-x-20 top-1/2 flex -translate-y-1/2 flex-col items-center text-center text-white">
        <p data-reveal className="max-w-[30rem] text-14 leading-17 tracking-[-0.02em] s:max-w-[32.5rem]">
          Newsletter sign-ups aren&apos;t open yet. No email address is collected here.
        </p>
      </div>
    </div>
  );
}
