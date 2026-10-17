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

function MenuRow({
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
      className="pointer-events-auto flex min-h-40 w-full items-center gap-10 border-b border-white/[0.07] px-3 text-left text-white/90 transition-colors hover:bg-white/[0.04] active:bg-white/[0.07] last:border-b-0"
    >
      <span className="flex size-20 shrink-0 items-center justify-center text-white/75">{icon}</span>
      <span className="min-w-0 flex-1 text-12 tracking-[-0.01em]">{children}</span>
      <svg viewBox="0 0 24 24" className="size-14 shrink-0 text-white/35" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ProfileOverlay({
  open,
  onMyProjects,
  onMyTemplates,
  onSmartEdit,
  onAdminTemplates,
  onWebsiteTemplates,
}: OverlayProps & {
  onMyProjects?: () => void;
  onMyTemplates?: () => void;
  onSmartEdit?: () => void;
  onAdminTemplates?: () => void;
  onWebsiteTemplates?: () => void;
}) {
  const { ref, visible } = useReveal(open);
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && !!session?.user;
  const [billingStatus, setBillingStatus] = useState({
    loaded: false,
    isPremium: false,
    checkoutEnabled: false,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null as string | null,
  });
  const [billingError, setBillingError] = useState<string | null>(null);

  // Poll only while the account menu is open so the card switches as soon as
  // the verified Dodo webhook updates the account in the database.
  useEffect(() => {
    if (!open || !signedIn) {
      if (!signedIn) {
        setBillingStatus({
          loaded: false,
          isPremium: false,
          checkoutEnabled: false,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        });
        setBillingError(null);
      }
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not verify the subscription.");
        const result = await response.json() as {
          isPremium?: boolean;
          billingConfigured?: boolean;
          cancelAtPeriodEnd?: boolean;
          currentPeriodEnd?: string | null;
        };
        if (cancelled) return;
        setBillingStatus({
          loaded: true,
          isPremium: result.isPremium === true,
          checkoutEnabled: result.billingConfigured === true,
          cancelAtPeriodEnd: result.cancelAtPeriodEnd === true,
          currentPeriodEnd: typeof result.currentPeriodEnd === "string" ? result.currentPeriodEnd : null,
        });
        setBillingError(null);
      } catch {
        if (!cancelled) setBillingError("Could not verify your subscription right now. Retrying…");
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [open, signedIn]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-15 s:px-25"
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <div
        data-reveal
        className="pointer-events-auto w-full max-h-[calc(100dvh-1.5rem)] max-w-[30rem] overflow-y-auto overscroll-contain rounded-[1.6rem] border border-white/10 bg-[#101010]/96 text-white shadow-[0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-12 px-18 pb-14 pt-18">
          {signedIn ? (
            <>
              <div className="relative flex size-42 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f2f0e8] via-[#bd82cf] to-[#d8c7e2] p-[2px] shadow-[0_0_20px_rgba(189,130,207,0.32)]">
                <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-[#191919] text-white/85">
                  {session.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ? `${session.user.name} account photo` : "Google account photo"}
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-14">{(session.user?.name || session.user?.email || "P").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-12 font-medium leading-15 tracking-[-0.02em]">
                  {session.user?.name ?? "Paper Stish user"}
                </p>
                <p className="mt-2 min-w-0 text-10 leading-13 text-white/55 [overflow-wrap:anywhere]">
                  {session.user?.email ?? ""}
                </p>
                <button
                  type="button"
                  onClick={() => signIn("google", { prompt: "select_account" })}
                  className="pointer-events-auto mt-4 text-9 text-white/55 underline decoration-white/20 underline-offset-3 transition-colors hover:text-white"
                >
                  Switch account
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="label opacity-55">PAPER STISH</p>
                <h2 className="mt-5 text-14 leading-17 tracking-[-0.03em]">Your account</h2>
              </div>
              <div className="flex size-38 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
                <UserIcon />
              </div>
            </>
          )}
        </div>

        <div className="px-14 pb-14">
          {!signedIn ? (
            <>
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
              <div data-reveal className="mt-14">
                <ProfileAction icon={<SparkIcon />} onClick={onWebsiteTemplates}>
                  Website Templates
                </ProfileAction>
              </div>
            </>
          ) : (
            <>
              <div data-reveal aria-live="polite" className="mb-10 rounded-[1.15rem] border border-white/[0.05] bg-[#242424] p-16">
                {!billingStatus.loaded ? (
                  <p className="py-8 text-10 leading-14 text-white/65">
                    {billingError ?? "Checking subscription…"}
                  </p>
                ) : billingStatus.isPremium ? (
                  <>
                    <div className="flex items-center gap-8">
                      <svg viewBox="0 0 24 24" className="size-16 shrink-0 text-[#d8c7e2]" fill="currentColor" aria-hidden="true">
                        <path d="M5 19h14l1.4-9-4.4 3-4-7-4 7-4.4-3L5 19Zm2 2h10v1H7v-1Z"/>
                      </svg>
                      <span className="rounded-[4px] bg-white/15 px-5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-white/85">
                        Pro
                      </span>
                    </div>
                    <p className="mt-7 text-10 leading-13 text-white/60">$4.99 / month</p>
                    {billingStatus.cancelAtPeriodEnd && billingStatus.currentPeriodEnd && (
                      <p className="mt-4 text-9 leading-12 text-white/50">
                        Active until {new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => window.location.assign("/subscription")}
                      disabled={!billingStatus.loaded}
                      className="pointer-events-auto mt-12 flex h-36 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-16 text-11 font-medium text-[#191919] transition-transform duration-200 hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                    >
                      Manage subscription
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rounded-[4px] bg-white/15 px-5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-white/75">Free</span>
                    <p className="mt-7 text-11 leading-14 text-white/85">Upgrade to Pro</p>
                    <p className="mt-3 text-10 leading-13 text-white/55">$4.99 / month</p>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/upgrade")}
                      className="pointer-events-auto mt-12 flex h-36 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-16 text-11 font-medium text-[#191919] transition-transform duration-200 hover:brightness-105 active:scale-[0.99]"
                    >
                      Explore Pro
                    </button>
                  </>
                )}
                {billingError && billingStatus.loaded && (
                  <p role="alert" className="mt-8 text-9 leading-12 text-white/60">{billingError}</p>
                )}
              </div>

              <nav data-reveal aria-label="Account actions" className="overflow-hidden rounded-[0.9rem]">
                <MenuRow icon={<UserIcon />} onClick={onMyProjects}>My Projects</MenuRow>
                <MenuRow
                  icon={<svg viewBox="0 0 24 24" className="size-16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3.5 7.5h6l2 2h9v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 7.5v-2a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2"/></svg>}
                  onClick={onMyTemplates}
                >
                  My Templates
                </MenuRow>
                <MenuRow icon={<SparkIcon />} onClick={onWebsiteTemplates}>Website Templates</MenuRow>
                <MenuRow icon={<SparkIcon />} onClick={onSmartEdit}>Smart Edit</MenuRow>
                {isAdminEmail(session.user?.email) && (
                  <MenuRow icon={<SparkIcon />} onClick={onAdminTemplates}>Admin Templates</MenuRow>
                )}
              </nav>

              <button
                type="button"
                onClick={() => window.location.assign("/subscription")}
                className="pointer-events-auto mt-8 flex min-h-38 w-full items-center gap-10 rounded-[0.85rem] px-3 text-left text-white/80 transition-colors hover:bg-white/[0.04]"
              >
                <span className="flex size-20 shrink-0 items-center justify-center text-white/65">
                  <svg viewBox="0 0 24 24" className="size-16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                </span>
                <span className="flex-1 text-11">Manage subscription</span>
                <span className="text-white/35">›</span>
              </button>

              <div data-reveal className="mt-8 border-t border-white/[0.08] pt-8">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="pointer-events-auto flex min-h-36 w-full items-center gap-10 rounded-[0.85rem] px-3 text-left text-11 text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <span className="flex size-20 items-center justify-center"><UserIcon /></span>
                  <span className="flex-1">Sign out</span>
                  <span className="text-white/35">›</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="px-16 pb-16 pt-8 text-center">
          <nav aria-label="Legal and support" className="label mb-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-5 text-[9px] text-white/45">
            <a href="/privacy" className="transition-opacity hover:text-white">Privacy</a>
            <span aria-hidden="true">•</span>
            <a href="/terms" className="transition-opacity hover:text-white">Terms</a>
            <span aria-hidden="true">•</span>
            <a href="mailto:sandeepdolai.info@gmail.com" className="transition-opacity hover:text-white">Support</a>
          </nav>
          <p className="text-9 font-medium tracking-[-0.01em] text-white/35">
            Making someone else happy is one of the best feelings.
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
