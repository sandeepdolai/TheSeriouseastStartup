"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

type Mode = "upgrade" | "manage";
type Billing = { loaded: boolean; isPremium: boolean; checkoutEnabled: boolean; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null };
type Action = "checkout" | "portal" | null;
const INITIAL: Billing = { loaded: false, isPremium: false, checkoutEnabled: false, cancelAtPeriodEnd: false, currentPeriodEnd: null };

function ArrowLeft() {
  return <svg viewBox="0 0 24 24" className="size-16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Crown() {
  return <svg viewBox="0 0 24 24" className="size-18" fill="currentColor" aria-hidden="true"><path d="M5 19h14l1.4-9-4.4 3-4-7-4 7-4.4-3L5 19Zm2 2h10v1H7v-1Z" /></svg>;
}
function CheckMark() {
  return <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function displayDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function BillingPage({ mode }: { mode: Mode }) {
  const { data: session, status: sessionStatus } = useSession();
  const signedIn = sessionStatus === "authenticated" && !!session?.user;
  const [billing, setBilling] = useState<Billing>(INITIAL);
  const [action, setAction] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("paper-stish-billing");
    return () => document.documentElement.classList.remove("paper-stish-billing");
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!signedIn) {
      setBilling({ ...INITIAL, loaded: true });
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        const result = await response.json() as { isPremium?: boolean; billingConfigured?: boolean; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null; error?: string };
        if (!response.ok) throw new Error(result.error || "Could not verify your subscription.");
        if (cancelled) return;
        setBilling({
          loaded: true,
          isPremium: result.isPremium === true,
          checkoutEnabled: result.billingConfigured === true,
          cancelAtPeriodEnd: result.cancelAtPeriodEnd === true,
          currentPeriodEnd: typeof result.currentPeriodEnd === "string" ? result.currentPeriodEnd : null,
        });
        setError(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not verify your subscription.");
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { cancelled = true; window.removeEventListener("focus", refresh); };
  }, [sessionStatus, signedIn]);

  const runCheckout = async () => {
    if (!signedIn) { void signIn("google", { callbackUrl: "/upgrade" }); return; }
    if (billing.isPremium) { window.location.assign("/subscription"); return; }
    if (!billing.checkoutEnabled) { window.location.assign("mailto:sandeepdolai.info@gmail.com?subject=Paper%20Stish%20Upgrade"); return; }
    if (action) return;
    setAction("checkout"); setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Could not start checkout. Please try again.");
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout. Please try again.");
      setAction(null);
    }
  };

  const runPortal = async () => {
    if (!signedIn) { void signIn("google", { callbackUrl: "/subscription" }); return; }
    if (action) return;
    setAction("portal"); setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Could not open subscription management.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open subscription management.");
      setAction(null);
    }
  };

  const date = displayDate(billing.currentPeriodEnd);
  const freeFeatures = [
    "Use Smart Edit and its core editing tools.",
    "Reuse every available Free sticker as often as you like—no sticker usage counter.",
    "Browse, preview, and edit photo and website templates, including Pro templates.",
    "Download designs that use only Free assets and features.",
    "Save drafts and return to your creative projects later.",
  ];
  const freeRestrictions = [
    "Publishing any website requires Pro.",
    "Exporting a design that contains Pro stickers, effects, or a Pro-only photo template requires Pro.",
    "Free photo uploads have a plan allowance; there is no per-sticker usage limit.",
  ];
  const proFeatures = [
    "Unlimited photo uploads, subject to reasonable technical and abuse protections.",
    "Every Free and Pro sticker, with unlimited use and no per-sticker caps.",
    "All photo and website templates, including Pro-only designs.",
    "Download designs containing Pro stickers, effects, and Pro-only photo templates.",
    "Publish websites created in the website-template editor.",
    "Access every Pro-exclusive editing tool, effect, and premium feature.",
    "No individual purchases required for included Pro assets.",
  ];

  return (
    <main className="billing-page text-[#191919]">
      <div className="mx-auto w-full max-w-[1100px]">
        <header className="flex min-h-[4.8rem] items-center justify-between gap-12 border-b border-[#e5e5e5] pb-13">
          <a href="/" className="text-[1.25rem] font-semibold tracking-[-0.05em] text-[#171717]">PAPER STISH</a>
          <span className="text-[0.95rem] font-medium uppercase tracking-[0.14em] text-[#737373]">Account / Billing</span>
        </header>

        <div className="mx-auto w-full max-w-[1020px] pb-30 pt-25 s:pt-42">
          <a href="/" className="inline-flex min-h-40 items-center gap-9 rounded-full px-3 text-[1.2rem] text-[#606060] transition-colors hover:bg-black/[0.04] hover:text-[#151515]">
            <ArrowLeft /> Back to Paper Stish
          </a>

          <section className="mt-24 max-w-[72rem]">
            <div className="flex items-center gap-9 text-[1rem] font-semibold uppercase tracking-[0.14em] text-[#826394]">
              <Crown /> {mode === "upgrade" ? "Paper Stish / Plans" : "Paper Stish / Account"}
            </div>
            <h1 className="mt-14 max-w-[13ch] text-[3.4rem] font-semibold leading-[1.02] tracking-[-0.06em] s:text-[5rem]">
              {mode === "upgrade" ? "Choose how you create." : "Your plan, clearly laid out."}
            </h1>
            <p className="mt-15 max-w-[67rem] text-[1.55rem] leading-[1.65] text-[#626262] s:text-[1.7rem]">
              {mode === "upgrade"
                ? "Edit freely with Free, or unlock every Paper Stish creative tool with Pro. Stickers have no usage-count limits—the plan only determines which sticker collection is unlocked."
                : "Check your current plan, manage billing securely, and compare what is included in Free and Pro."}
            </p>
          </section>

          {mode === "manage" && (
            <section aria-labelledby="current-plan-heading" className="mt-24 rounded-[1.8rem] border border-[#e2e2e2] bg-[#fafafa] p-20 s:p-26">
              <div className="flex flex-wrap items-start justify-between gap-14">
                <div className="min-w-0 flex-1">
                  <p className="text-[1rem] font-semibold uppercase tracking-[0.13em] text-[#777]">Your subscription</p>
                  <h2 id="current-plan-heading" className="mt-9 text-[2.6rem] font-semibold tracking-[-0.045em]">
                    {!billing.loaded && !error ? "Checking your plan…" : !signedIn ? "Sign in to view your plan" : billing.isPremium ? "Pro" : "Free"}
                  </h2>
                  <p className="mt-8 max-w-[52rem] text-[1.35rem] leading-[1.6] text-[#626262]">
                    {!billing.loaded && !error
                      ? "Verifying your account with the billing service."
                      : !signedIn
                        ? "Your subscription details are connected to your Paper Stish account."
                        : billing.isPremium
                          ? billing.cancelAtPeriodEnd && date
                            ? "Your Pro access continues until " + date + "."
                            : date
                              ? "Your Pro subscription is active. Your next billing date is " + date + "."
                              : "Your Pro subscription is active."
                          : "You are on the Free plan. Upgrade whenever you need Pro stickers, premium exports, unlimited photo uploads, or website publishing."}
                  </p>
                  {signedIn && session?.user && (
                    <p className="mt-10 break-all text-[1.1rem] text-[#777]">
                      {session.user.name || session.user.email || "Paper Stish account"}
                    </p>
                  )}
                </div>
                {billing.loaded && signedIn && (
                  <span className={"shrink-0 rounded-full px-12 py-7 text-[1rem] font-semibold " + (billing.isPremium ? "bg-[#f0e6f6] text-[#68477c]" : "bg-[#eaeaea] text-[#555]")}>
                    {billing.isPremium ? billing.cancelAtPeriodEnd ? "Ending at period end" : "Active" : "Free forever"}
                  </span>
                )}
              </div>
              <div className="mt-18 flex flex-col gap-10 border-t border-[#e6e6e6] pt-17 s:flex-row s:items-center">
                {billing.isPremium ? (
                  <button type="button" disabled={action !== null || !billing.loaded || !signedIn} onClick={() => void runPortal()} className="flex min-h-[4.6rem] w-full items-center justify-center rounded-full bg-[#171717] px-20 text-[1.3rem] font-semibold text-white transition-colors hover:bg-[#333] disabled:cursor-wait disabled:opacity-60 s:w-auto s:min-w-[22rem]">
                    {action === "portal" ? "Opening secure billing portal…" : "Manage billing"}
                  </button>
                ) : (
                  <button type="button" onClick={() => signedIn ? window.location.assign("/upgrade") : void signIn("google", { callbackUrl: "/subscription" })} className="flex min-h-[4.6rem] w-full items-center justify-center rounded-full bg-[#171717] px-20 text-[1.3rem] font-semibold text-white transition-colors hover:bg-[#333] s:w-auto s:min-w-[22rem]">
                    {signedIn ? "Explore Pro" : "Sign in to continue"}
                  </button>
                )}
                <p className="text-[1.15rem] leading-[1.5] text-[#777]">
                  {billing.isPremium ? "Manage payment details, invoices, or cancellation in the secure billing portal." : "Your drafts stay available when you upgrade."}
                </p>
              </div>
              {error && <p role="alert" className="mt-12 rounded-xl border border-[#e4caca] bg-[#fff7f7] px-14 py-12 text-[1.2rem] leading-[1.5] text-[#843d3d]">{error}</p>}
            </section>
          )}

          <section aria-labelledby="plans-heading" className="mt-26">
            <div className="mb-16">
              <h2 id="plans-heading" className="text-[2.4rem] font-semibold tracking-[-0.045em]">Free vs Pro</h2>
              <p className="mt-6 max-w-[64rem] text-[1.3rem] leading-[1.6] text-[#696969]">
                Both plans let you edit. Pro unlocks premium assets and the right to export Pro work or publish a website.
              </p>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-16 s:grid-cols-2 s:gap-20">
              <section aria-labelledby="free-plan-heading" className="flex min-w-0 flex-col rounded-[1.8rem] border border-[#dedede] bg-white p-20 s:p-26">
                <div className="flex items-center justify-between gap-10">
                  <h3 id="free-plan-heading" className="text-[2.5rem] font-semibold tracking-[-0.045em]">Free</h3>
                  <span className="rounded-full bg-[#ededed] px-12 py-7 text-[1rem] font-semibold text-[#4b4b4b]">Free forever</span>
                </div>
                <div className="mt-17 flex items-baseline gap-8">
                  <span className="text-[4rem] font-semibold leading-none tracking-[-0.07em]">$0</span>
                </div>
                <p className="mt-10 text-[1.35rem] leading-[1.55] text-[#656565]">Create, experiment, and edit without paying.</p>
                <div className="my-19 border-t border-[#e9e9e9]" />
                <ul className="space-y-15">
                  {freeFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-12">
                      <span className="mt-2 shrink-0 text-[#08794c]"><CheckMark /></span>
                      <span className="text-[1.45rem] leading-[1.55] text-[#242424]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="my-19 border-t border-[#e9e9e9]" />
                <h4 className="text-[1.2rem] font-medium text-[#707070]">Restrictions</h4>
                <ul className="mt-13 space-y-13">
                  {freeRestrictions.map((restriction) => (
                    <li key={restriction} className="flex items-start gap-12">
                      <span className="mt-2 shrink-0 text-[#686868]" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="size-16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4.5" y="10" width="15" height="11" rx="2.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3" strokeLinecap="round"/></svg>
                      </span>
                      <span className="text-[1.35rem] leading-[1.55] text-[#323232]">{restriction}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-22">
                  <span className="inline-flex rounded-full border border-[#e4e4e4] px-12 py-8 text-[1.1rem] text-[#606060]">
                    {signedIn && !billing.isPremium ? "Your current plan" : "Available to everyone"}
                  </span>
                </div>
              </section>

              <section aria-labelledby="pro-plan-heading" className="relative flex min-w-0 flex-col rounded-[1.8rem] border border-[#b89bc8] bg-white p-20 s:p-26">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-2 rounded-t-[1.8rem] bg-[#b89bc8]" />
                <div className="flex items-center justify-between gap-10">
                  <h3 id="pro-plan-heading" className="text-[2.5rem] font-semibold tracking-[-0.045em]">Pro</h3>
                  <span className="rounded-full bg-[#f0e5f8] px-12 py-7 text-[1rem] font-semibold text-[#714d86]">Full access</span>
                </div>
                <div className="mt-17 flex items-baseline gap-8">
                  <span className="text-[4rem] font-semibold leading-none tracking-[-0.07em]">$4.99</span>
                  <span className="text-[1.25rem] text-[#666]">/ month</span>
                </div>
                <p className="mt-10 text-[1.35rem] leading-[1.55] text-[#656565]">Everything unlocked for the full Paper Stish experience.</p>
                <div className="my-19 border-t border-[#e9e9e9]" />
                <ul className="space-y-15">
                  {proFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-12">
                      <span className="mt-2 shrink-0 text-[#08794c]"><CheckMark /></span>
                      <span className="text-[1.45rem] leading-[1.55] text-[#242424]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-24">
                  <button type="button" disabled={action !== null || !billing.loaded} onClick={() => billing.isPremium ? window.location.assign("/subscription") : void runCheckout()} className="flex min-h-[4.8rem] w-full items-center justify-center rounded-full bg-[#171717] px-18 text-[1.3rem] font-semibold text-white transition-colors hover:bg-[#333] disabled:cursor-wait disabled:opacity-60">
                    {action === "checkout" ? "Opening secure checkout…" : billing.isPremium ? "Manage your Pro subscription" : !signedIn ? "Sign in to unlock Pro" : billing.checkoutEnabled ? "Unlock Pro" : "Contact us to upgrade"}
                  </button>
                  <p className="mt-10 text-center text-[1.1rem] leading-[1.5] text-[#777]">
                    {billing.isPremium ? "Your Pro access is active." : "Keep editing. Your draft stays saved if you decide not to upgrade."}
                  </p>
                </div>
              </section>
            </div>
            {error && mode === "upgrade" && <p role="alert" className="mt-14 rounded-xl border border-[#e4caca] bg-[#fff7f7] px-14 py-12 text-[1.2rem] leading-[1.5] text-[#843d3d]">{error}</p>}
          </section>

          <p className="mt-20 rounded-xl bg-[#f7f7f7] px-16 py-14 text-[1.2rem] leading-[1.6] text-[#6a6a6a]">
            Sticker usage is never counted per sticker. Free users can reuse the Free collection without a usage cap; Pro unlocks the Pro collection as well. Website publishing requires Pro, and Free users can continue editing without losing their draft.
          </p>

          <footer className="mt-25 flex flex-wrap items-center justify-between gap-12 border-t border-[#e5e5e5] pt-16 text-[1rem] text-[#737373]">
            <span>© {new Date().getFullYear()} Paper Stish</span>
            <nav className="flex items-center gap-15">
              <a href="/privacy" className="hover:text-[#191919]">Privacy</a>
              <a href="/terms" className="hover:text-[#191919]">Terms</a>
              <a href="mailto:sandeepdolai.info@gmail.com?subject=Paper%20Stish%20Subscription" className="hover:text-[#191919]">Support</a>
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}