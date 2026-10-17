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
  const [checkoutReturn, setCheckoutReturn] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("paper-stish-billing");
    return () => document.documentElement.classList.remove("paper-stish-billing");
  }, []);

  useEffect(() => {
    setCheckoutReturn(new URLSearchParams(window.location.search).get("billing") === "return");
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!signedIn) {
      setBilling({ ...INITIAL, loaded: true });
      return;
    }
    let cancelled = false;
    let pollTimer: number | undefined;
    let pollAttempts = 0;
    const refresh = async (): Promise<boolean> => {
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        const result = await response.json() as { isPremium?: boolean; billingConfigured?: boolean; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null; error?: string };
        if (!response.ok) throw new Error(result.error || "Could not verify your subscription.");
        if (cancelled) return false;
        setBilling({
          loaded: true,
          isPremium: result.isPremium === true,
          checkoutEnabled: result.billingConfigured === true,
          cancelAtPeriodEnd: result.cancelAtPeriodEnd === true,
          currentPeriodEnd: typeof result.currentPeriodEnd === "string" ? result.currentPeriodEnd : null,
        });
        setError(null);
        if (result.isPremium === true && pollTimer !== undefined) window.clearInterval(pollTimer);
        return result.isPremium === true;
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not verify your subscription.");
        return false;
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    if (checkoutReturn) {
      pollTimer = window.setInterval(() => {
        pollAttempts += 1;
        if (pollAttempts >= 10) {
          if (pollTimer !== undefined) window.clearInterval(pollTimer);
          setCheckoutReturn(false);
          return;
        }
        void refresh();
      }, 3000);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
    };
  }, [sessionStatus, signedIn, checkoutReturn]);

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
    "Smart Edit essentials",
    "Free stickers — unlimited use",
    "Edit every template",
    "Limited photo uploads",
    "Download Free-only designs",
  ];
  const proFeatures = [
    "Every sticker and template",
    "Unlimited photo uploads",
    "Export any design",
    "Publish websites",
    "Every Pro tool and effect",
  ];

  return (
    <main className="billing-page">
      <div className="mx-auto w-full max-w-[1060px]">
        <header className="flex min-h-[5.2rem] items-center justify-between gap-12 border-b border-[#e6eaf0]">
          <a href="/" className="text-[1.3rem] font-bold tracking-[-0.055em] text-[#17191d]">PAPER STISH</a>
          <span className="rounded-full bg-[#eef6ff] px-12 py-7 text-[1rem] font-medium text-[#1768c4]">Plans &amp; billing</span>
        </header>

        <div className="mx-auto w-full max-w-[940px] pb-28 pt-20 s:pt-30">
          <a href="/" className="inline-flex min-h-36 items-center gap-8 rounded-full text-[1.15rem] font-medium text-[#6b7280] transition-colors hover:text-[#17191d]">
            <ArrowLeft /> Back to Paper Stish
          </a>

          <section className="mx-auto mt-21 max-w-[660px] text-center">
            <div className="mx-auto flex size-38 items-center justify-center rounded-[1.1rem] bg-[#eaf4ff] text-[#087cf0]">
              <Crown />
            </div>
            <h1 className="mt-15 text-[3.4rem] font-semibold leading-[1.04] tracking-[-0.06em] text-[#17191d] s:text-[4.8rem]">
              {mode === "upgrade" ? "Make more with Pro." : "Your plan, simplified."}
            </h1>
            <p className="mx-auto mt-10 max-w-[49rem] text-[1.4rem] leading-[1.55] text-[#667085] s:text-[1.55rem]">
              {mode === "upgrade"
                ? "Edit freely. Upgrade when you’re ready to unlock it all."
                : "View your plan and manage your subscription."}
            </p>
          </section>

          {mode === "manage" && (
            <section aria-labelledby="current-plan-heading" className="mt-22 rounded-[1.5rem] border border-[#dbeafe] bg-[#f5f9ff] p-18 s:p-22">
              <div className="flex flex-wrap items-center justify-between gap-12">
                <div className="min-w-0">
                  <p className="text-[1rem] font-semibold uppercase tracking-[0.11em] text-[#667085]">Current plan</p>
                  <div className="mt-7 flex flex-wrap items-center gap-9">
                    <h2 id="current-plan-heading" className="text-[2.5rem] font-semibold tracking-[-0.05em] text-[#17191d]">
                      {!billing.loaded && !error ? "Checking…" : !signedIn ? "Sign in required" : billing.isPremium ? "Pro" : "Free"}
                    </h2>
                    {billing.loaded && signedIn && (
                      <span className={"rounded-full px-10 py-5 text-[0.95rem] font-semibold " + (billing.isPremium ? "bg-[#dceeff] text-[#0b63c7]" : "bg-[#e8edf3] text-[#526071]")}>
                        {billing.isPremium ? billing.cancelAtPeriodEnd ? "Ending soon" : "Active" : "Free forever"}
                      </span>
                    )}
                  </div>
                  <p className="mt-5 text-[1.15rem] leading-[1.5] text-[#667085]">
                    {!billing.loaded && !error
                      ? "Checking subscription details."
                      : !signedIn
                        ? "Sign in to see your subscription."
                        : billing.isPremium
                          ? billing.cancelAtPeriodEnd && date ? "Access until " + date : date ? "Renews " + date : "Your Pro subscription is active."
                          : checkoutReturn ? "Confirming your checkout with Dodo Payments…" : "Unlock Pro features whenever you need them."}
                  </p>
                </div>
                {!signedIn ? (
                  <button type="button" onClick={() => void signIn("google", { callbackUrl: "/subscription" })} className="flex min-h-[4.2rem] items-center justify-center rounded-full bg-[#087cf0] px-18 text-[1.15rem] font-semibold text-white transition-colors hover:bg-[#066bd1]">
                    Sign in
                  </button>
                ) : billing.isPremium ? (
                  <button type="button" disabled={action !== null || !billing.loaded} onClick={() => void runPortal()} className="flex min-h-[4.2rem] items-center justify-center rounded-full bg-[#087cf0] px-18 text-[1.15rem] font-semibold text-white transition-colors hover:bg-[#066bd1] disabled:opacity-60">
                    {action === "portal" ? "Opening…" : "Manage billing"}
                  </button>
                ) : (
                  <button type="button" onClick={() => window.location.assign("/upgrade")} className="flex min-h-[4.2rem] items-center justify-center rounded-full bg-[#087cf0] px-18 text-[1.15rem] font-semibold text-white transition-colors hover:bg-[#066bd1]">
                    Upgrade to Pro
                  </button>
                )}
              </div>
              {error && <p role="alert" className="mt-12 rounded-xl border border-[#f3caca] bg-white px-12 py-10 text-[1.1rem] text-[#963737]">{error}</p>}
            </section>
          )}

          <section aria-labelledby="plans-heading" className="mt-23">
            <div className="mb-13 flex items-end justify-between gap-12">
              <h2 id="plans-heading" className="text-[2rem] font-semibold tracking-[-0.045em] text-[#17191d]">Choose your plan</h2>
              <span className="text-[1rem] text-[#828b99]">USD / month</span>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-14 s:grid-cols-2 s:gap-18">
              <section aria-labelledby="free-plan-heading" className="flex min-w-0 flex-col rounded-[1.5rem] border border-[#e1e6ed] bg-white p-19 s:p-23">
                <div className="flex items-center justify-between gap-8">
                  <h3 id="free-plan-heading" className="text-[2.3rem] font-semibold tracking-[-0.05em] text-[#17191d]">Free</h3>
                  <span className="rounded-full bg-[#f1f3f6] px-10 py-6 text-[0.95rem] font-medium text-[#526071]">Free forever</span>
                </div>
                <div className="mt-15 flex items-baseline gap-7">
                  <span className="text-[3.8rem] font-semibold leading-none tracking-[-0.07em] text-[#17191d]">$0</span>
                </div>
                <p className="mt-8 min-h-[2.6rem] text-[1.2rem] leading-[1.5] text-[#737d8b]">Create at your own pace.</p>
                <div className="my-16 border-t border-[#edf0f4]" />
                <ul className="space-y-14">
                  {freeFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-10">
                      <span className="mt-2 shrink-0 text-[#157347]"><CheckMark /></span>
                      <span className="text-[1.25rem] leading-[1.45] text-[#303641]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-15 rounded-xl bg-[#f7f8fa] px-12 py-10 text-[1.05rem] leading-[1.5] text-[#6d7684]">
                  Website publishing and Pro exports require Pro.
                </p>
                <div className="mt-auto pt-17">
                  <button type="button" disabled className="flex min-h-[4.4rem] w-full items-center justify-center rounded-full border border-[#dfe4eb] bg-white px-16 text-[1.15rem] font-semibold text-[#454d58] disabled:cursor-default">
                    {signedIn && !billing.isPremium ? "Your current plan" : "Free plan"}
                  </button>
                </div>
              </section>

              <section aria-labelledby="pro-plan-heading" className="relative flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-[#9bc9ff] bg-white p-19 s:p-23">
                <div className="absolute inset-x-0 top-0 h-[0.35rem] bg-[#087cf0]" />
                <div className="flex items-center justify-between gap-8">
                  <h3 id="pro-plan-heading" className="text-[2.3rem] font-semibold tracking-[-0.05em] text-[#17191d]">Pro</h3>
                  <span className="rounded-full bg-[#e8f3ff] px-10 py-6 text-[0.95rem] font-semibold text-[#126bcb]">Everything</span>
                </div>
                <div className="mt-15 flex items-baseline gap-7">
                  <span className="text-[3.8rem] font-semibold leading-none tracking-[-0.07em] text-[#17191d]">$4.99</span>
                  <span className="text-[1.15rem] text-[#737d8b]">/ month</span>
                </div>
                <p className="mt-8 min-h-[2.6rem] text-[1.2rem] leading-[1.5] text-[#737d8b]">Everything, unlocked.</p>
                <div className="my-16 border-t border-[#edf0f4]" />
                <ul className="space-y-14">
                  {proFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-10">
                      <span className="mt-2 shrink-0 text-[#087cf0]"><CheckMark /></span>
                      <span className="text-[1.25rem] leading-[1.45] text-[#303641]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-15 rounded-xl bg-[#f0f7ff] px-12 py-10 text-[1.05rem] leading-[1.5] text-[#35628f]">
                  One plan. No add-on purchases.
                </p>
                <div className="mt-auto pt-17">
                  <button type="button" disabled={action !== null || !billing.loaded} onClick={() => billing.isPremium ? window.location.assign("/subscription") : void runCheckout()} className="flex min-h-[4.4rem] w-full items-center justify-center rounded-full bg-[#087cf0] px-16 text-[1.15rem] font-semibold text-white transition-colors hover:bg-[#066bd1] disabled:cursor-wait disabled:opacity-60">
                    {action === "checkout" ? "Opening checkout…" : billing.isPremium ? "Manage Pro" : !signedIn ? "Sign in to upgrade" : billing.checkoutEnabled ? "Get Pro" : "Contact to upgrade"}
                  </button>
                  <p className="mt-8 text-center text-[1rem] leading-[1.45] text-[#828b99]">Your drafts stay saved if you don’t upgrade.</p>
                </div>
              </section>
            </div>
          </section>

          <footer className="mt-22 flex flex-wrap items-center justify-between gap-12 border-t border-[#e6eaf0] pt-15 text-[1rem] text-[#7b8492]">
            <span>© {new Date().getFullYear()} Paper Stish</span>
            <nav className="flex items-center gap-13">
              <a href="/privacy" className="hover:text-[#087cf0]">Privacy</a>
              <a href="/terms" className="hover:text-[#087cf0]">Terms</a>
              <a href="mailto:sandeepdolai.info@gmail.com?subject=Paper%20Stish%20Subscription" className="hover:text-[#087cf0]">Support</a>
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}