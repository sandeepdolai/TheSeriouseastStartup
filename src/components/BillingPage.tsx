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
  return (
    <main className="billing-page">
      <div className="mx-auto w-full max-w-[1080px]">
        <header className="flex min-h-46 items-center justify-between gap-12 border-b border-white/[0.10] pb-13">
          <a href="/" className="text-12 font-semibold tracking-[-0.05em] text-white">PAPER STISH</a>
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">Account / Billing</span>
        </header>

        <div className="mx-auto grid w-full max-w-[900px] gap-24 pb-20 pt-26 s:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] s:items-start s:gap-40 s:pt-50">
          <section className="min-w-0">
            <a href="/" className="inline-flex min-h-40 items-center gap-9 rounded-full px-3 text-11 text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"><ArrowLeft /> Back to Paper Stish</a>
            {mode === "upgrade" ? (
              <>
                <div className="mt-28 flex items-center gap-8 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8c7e2]"><Crown /> Paper Stish Pro</div>
                <h1 className="mt-15 max-w-[12ch] text-40 leading-[0.98] tracking-[-0.065em] s:mt-22 s:text-55">Make more room for the moments that matter.</h1>
                <p className="mt-16 max-w-[37rem] text-14 leading-21 tracking-[-0.025em] text-white/55 s:text-16 s:leading-24">Pro gives your creative work a more complete home in Paper Stish. Review the plan and payment details before confirming.</p>
                <div className="mt-25 flex flex-wrap items-center gap-10 text-10 text-white/45">
                  <span className="rounded-full border border-white/10 px-11 py-7">Personal websites</span>
                  <span className="rounded-full border border-white/10 px-11 py-7">Creative projects</span>
                  <span className="rounded-full border border-white/10 px-11 py-7">Shareable memories</span>
                </div>
              </>
            ) : (
              <>
                <div className="mt-28 flex items-center gap-8 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8c7e2]"><Crown /> Account billing</div>
                <h1 className="mt-15 max-w-[12ch] text-40 leading-[0.98] tracking-[-0.065em] s:mt-22 s:text-55">Manage your subscription.</h1>
                <p className="mt-16 max-w-[37rem] text-14 leading-21 tracking-[-0.025em] text-white/55 s:text-16 s:leading-24">Your plan, renewal information, and subscription controls—all in one place.</p>
              </>
            )}
            <div className="mt-26 border-t border-white/10 pt-17">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Paper Stish / Account</p>
              <div className="mt-16 flex items-start gap-12">
                <div className="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-[#d8c7e2]">
                  {session?.user?.image ? <img src={session.user.image} alt="" className="size-full object-cover" /> : <span>{(session?.user?.name || session?.user?.email || "P").slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 pt-2">
                  <p className="truncate text-12 text-white/90">{session?.user?.name || "Your account"}</p>
                  <p className="mt-2 break-all text-10 text-white/40">{session?.user?.email || "Sign in to link your subscription to your account."}</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            {mode === "upgrade" ? (
              <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#141314]">
                <div className="border-b border-white/[0.09] bg-[radial-gradient(circle_at_100%_0%,rgba(189,130,207,.14),transparent_60%)] p-20 s:p-24">
                  <div className="flex items-center justify-between gap-12">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">Pro</span>
                    <span className="rounded-full border border-[#d8c7e2]/25 bg-[#d8c7e2]/[0.08] px-10 py-5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#d8c7e2]">Monthly</span>
                  </div>
                  <div className="mt-18 flex items-baseline gap-7"><span className="text-42 font-medium leading-none tracking-[-0.07em]">$4.99</span><span className="text-12 text-white/45">/ month</span></div>
                  <p className="mt-9 text-10 leading-15 text-white/40">The total and billing terms are shown again at secure checkout.</p>
                </div>
                <div className="p-20 s:p-24">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/40">Included in your experience</p>
                  <div className="mt-15 space-y-13">
                    {[
                      ["Create", "Personalize designs around your own words and images."],
                      ["Keep", "Return to your creative projects from your Paper Stish workspace."],
                      ["Share", "Publish personal websites and share them with a link."],
                    ].map(([label, description]) => (
                      <div key={label} className="flex items-start gap-10">
                        <span className="mt-1 flex size-19 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#d8c7e2]"><CheckMark /></span>
                        <div><p className="text-11 text-white/90">{label}</p><p className="mt-3 text-10 leading-15 text-white/45">{description}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-19 border-t border-white/[0.09] pt-15">
                    {!billing.loaded && !error ? (
                      <p className="text-10 leading-15 text-white/45">Checking your account and subscription availability…</p>
                    ) : !signedIn ? (
                      <button type="button" onClick={() => void signIn("google", { callbackUrl: "/upgrade" })} className="flex h-46 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-18 text-12 font-medium text-[#191919] hover:brightness-105">Sign in to continue</button>
                    ) : billing.isPremium ? (
                      <button type="button" onClick={() => window.location.assign("/subscription")} className="flex h-46 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-18 text-12 font-medium text-[#191919] hover:brightness-105">You’re a member · Manage plan</button>
                    ) : (
                      <button type="button" disabled={action !== null || !billing.loaded} onClick={() => void runCheckout()} className="flex h-46 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-18 text-12 font-medium text-[#191919] hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
                        {action === "checkout" ? "Opening secure checkout…" : billing.checkoutEnabled ? "Continue to secure checkout" : "Contact us to upgrade"}
                      </button>
                    )}
                    {error && <p role="alert" className="mt-10 rounded-10 border border-white/10 bg-white/[0.04] px-12 py-10 text-10 leading-15 text-white/65">{error}</p>}
                    {billing.loaded && !billing.checkoutEnabled && signedIn && !billing.isPremium && !error && <p className="mt-9 text-9 leading-13 text-white/35">Checkout is not configured yet. Contact support and we’ll help with your upgrade.</p>}
                  </div>
                </div>
              </section>
            ) : (
              <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#141314]">
                <div className="border-b border-white/[0.09] p-20 s:p-24">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">Your current plan</p>
                  {!billing.loaded && !error ? (
                    <p className="mt-16 text-12 text-white/50">Verifying your subscription…</p>
                  ) : !signedIn ? (
                    <>
                      <h2 className="mt-13 text-25 tracking-[-0.055em]">Sign in to manage billing.</h2>
                      <p className="mt-8 text-11 leading-17 text-white/45">Your subscription is connected to your Paper Stish account.</p>
                      <button type="button" onClick={() => void signIn("google", { callbackUrl: "/subscription" })} className="mt-16 flex h-44 w-full items-center justify-center rounded-full bg-[#f2f0e8] text-12 font-medium text-[#191919]">Sign in with Google</button>
                    </>
                  ) : billing.isPremium ? (
                    <>
                      <div className="mt-13 flex items-center justify-between gap-10">
                        <h2 className="text-25 tracking-[-0.055em]">Pro</h2>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-10 py-5 text-[8px] font-semibold uppercase tracking-[0.09em] text-[#d8c7e2]">{billing.cancelAtPeriodEnd ? "Ending" : "Active"}</span>
                      </div>
                      <div className="mt-11 flex items-baseline gap-7"><span className="text-21 tracking-[-0.05em]">$4.99</span><span className="text-10 text-white/45">/ month</span></div>
                      <p className="mt-12 border-t border-white/[0.08] pt-12 text-11 leading-17 text-white/65">
                        {billing.cancelAtPeriodEnd && date ? `Your access continues until ${date}.` : date ? `Your next billing date is ${date}.` : "Your Pro subscription is active."}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mt-13 flex items-center justify-between gap-10">
                        <h2 className="text-25 tracking-[-0.055em]">Free</h2>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-10 py-5 text-[8px] font-semibold uppercase tracking-[0.09em] text-white/45">No paid plan</span>
                      </div>
                      <p className="mt-11 text-11 leading-17 text-white/50">There is no active paid subscription on this account right now.</p>
                    </>
                  )}
                </div>
                <div className="p-20 s:p-24">
                  {billing.isPremium ? (
                    <>
                      <button type="button" disabled={action !== null || !billing.loaded} onClick={() => void runPortal()} className="flex h-46 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-18 text-12 font-medium text-[#191919] hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
                        {action === "portal" ? "Opening secure billing portal…" : "Open billing portal"}
                      </button>
                      <p className="mt-10 text-10 leading-15 text-white/40">Update your payment method, review invoices, or manage cancellation in the secure billing portal.</p>
                    </>
                  ) : (
                    <button type="button" onClick={() => window.location.assign("/upgrade")} className="flex h-46 w-full items-center justify-center rounded-full bg-[#f2f0e8] px-18 text-12 font-medium text-[#191919] hover:brightness-105">Explore Pro</button>
                  )}
                  {error && <p role="alert" className="mt-10 rounded-10 border border-white/10 bg-white/[0.04] px-12 py-10 text-10 leading-15 text-white/65">{error}</p>}
                  {billing.loaded && !billing.checkoutEnabled && signedIn && <p className="mt-11 text-9 leading-14 text-white/35">Billing configuration is unavailable. Please contact support for assistance.</p>}
                </div>
              </section>
            )}
            <p className="mt-14 px-7 text-center text-9 leading-14 text-white/35">
              Need help? <a href="mailto:sandeepdolai.info@gmail.com?subject=Paper%20Stish%20Subscription" className="underline decoration-white/20 underline-offset-3 hover:text-white/65">Contact support</a>. By subscribing, you agree to our <a href="/terms" className="underline decoration-white/20 underline-offset-3 hover:text-white/65">Terms</a> and <a href="/privacy" className="underline decoration-white/20 underline-offset-3 hover:text-white/65">Privacy Policy</a>.
            </p>
          </aside>
        </div>

        <footer className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-12 border-t border-white/[0.08] pt-16 text-9 text-white/35">
          <span>© {new Date().getFullYear()} Paper Stish</span>
          <nav className="flex items-center gap-14">
            <a href="/privacy" className="hover:text-white/70">Privacy</a>
            <a href="/terms" className="hover:text-white/70">Terms</a>
            <a href="mailto:sandeepdolai.info@gmail.com" className="hover:text-white/70">Support</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
