"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Small UI atoms + icons matching the Paper Stish design language (pill
   buttons, dark surfaces, tight tracking, the app's 0.1rem spacing scale).
─────────────────────────────────────────────────────────────────────────── */

import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/* ── Icons (inline, matching the app's existing icon style) ─────────────── */

function strokeIcon(path: ReactNode, size = "size-16") {
  return (
    <svg
      viewBox="0 0 24 24"
      className={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const IconText = () => strokeIcon(<path d="M5 7V5h14v2M12 5v14M9 19h6" />);
export const IconLibrary = () =>
  strokeIcon(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>,
  );
export const IconUpload = () =>
  strokeIcon(<path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />);
export const IconLayers = () =>
  strokeIcon(
    <>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" />
      <path d="m5.5 12.5-2 1 8.5 4.5 8.5-4.5-2-1" opacity=".55" />
      <path d="m5.5 16.5-2 1L12 22l8.5-4.5-2-1" opacity=".3" />
    </>,
  );
export const IconDelete = () =>
  strokeIcon(<path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m3 0-1 13H7L6 7M10 11v5m4-5v5" />);
export const IconUndo = () =>
  strokeIcon(<path d="M8 5 4 9l4 4M4 9h9a6 6 0 0 1 0 12h-3" />);
export const IconRedo = () =>
  strokeIcon(<path d="m16 5 4 4-4 4M20 9h-9a6 6 0 0 0 0 12h3" />);
export const IconDownload = () =>
  strokeIcon(<path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />);
export const IconClose = () => strokeIcon(<path d="M6 6l12 12M18 6 6 18" />);
export const IconEye = () =>
  strokeIcon(
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );
export const IconEyeOff = () =>
  strokeIcon(
    <>
      <path d="M4 4l16 16M9.9 5.9A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-2.7 3.4M6.2 8.2A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.4-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>,
  );
export const IconLock = () =>
  strokeIcon(
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>,
  );
export const IconUnlock = () =>
  strokeIcon(
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.7-1.5" />
    </>,
  );
export const IconUp = () => strokeIcon(<path d="m6 14 6-6 6 6" />);
export const IconDown = () => strokeIcon(<path d="m6 10 6 6 6-6" />);
export const IconDuplicate = () =>
  strokeIcon(
    <>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
      <path d="M15 6.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1.5" />
    </>,
  );
export const IconEdit = () =>
  strokeIcon(<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />);
export const IconPublish = () => strokeIcon(<path d="M5 13.5 12 6l7 7.5M12 6v14" />);

/* ── Buttons ────────────────────────────────────────────────────────────── */

export function IconButton({
  onClick,
  label,
  disabled,
  active,
  children,
  className = "",
}: {
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex size-40 items-center justify-center rounded-full transition-colors duration-200 ${
        active ? "bg-white text-black" : "bg-white/8 text-white/85 hover:bg-white/16"
      } disabled:pointer-events-none disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}

export function ToolButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick?: () => void;
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex min-h-44 flex-col items-center justify-center gap-4 rounded-14 px-6 transition-colors duration-200 ${
        active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Sheet shell (mobile bottom sheet) ──────────────────────────────────── */

/**
 * The sheet backdrop spans from just below the Smart Edit header down to
 * the top of the on-screen keyboard (--se-kb, maintained by the editor via
 * the visualViewport API):
 *   • the background canvas cannot receive touches while the sheet is open
 *   • the fixed header (Close / Undo / Redo / Save / Publish) stays
 *     reachable at all times — the sheet never covers it
 *   • sheet content can never be clipped behind the keyboard or browser UI
 *
 * The header height is measured at runtime by the editor (--se-header-h),
 * so the sheet always starts exactly at the header's bottom edge — no
 * rem-coupled magic number. A scrim dims the editor behind the sheet so it
 * reads as a proper modal: the canvas (and any selection UI on it) is
 * clearly inactive while touches belong to the sheet.
 *
 * The sheet itself is a flex column: fixed header row + scrollable body
 * (flex-1 min-h-0) — no magic pixel heights, so the content is always
 * reachable and scrolls naturally at any viewport / font scale.
 */
export function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed left-0 right-0 z-[70] flex flex-col justify-end bg-black/45"
      style={{
        top: "calc(var(--se-header-h, 7.2rem) + env(safe-area-inset-top))",
        bottom: "var(--se-kb, 0px)",
      }}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100%-14px)] flex-col rounded-t-[22px] border-t border-white/10 bg-[#151515] shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex shrink-0 items-center justify-between px-20 pb-8 pt-12">
          <p className="text-15 tracking-[-0.03em]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex size-32 items-center justify-center rounded-full bg-white/7 text-white/65"
          >
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-15 pb-20">{children}</div>
      </div>
    </div>
  );
}

/* ── Modal shell ────────────────────────────────────────────────────────── */

/**
 * Centered modal. The backdrop stops at the top of the on-screen keyboard
 * (--se-kb) so inputs near the bottom of the modal stay visible and tappable
 * on mobile; on desktop the value is 0 and the modal behaves as before.
 */
export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  width = 440,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed left-0 right-0 top-0 z-[90] flex items-center justify-center bg-black/55 px-15 backdrop-blur-[10px]"
      style={{ bottom: "var(--se-kb, 0px)" }}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full overflow-y-auto rounded-[22px] border border-white/10 bg-[#121212] p-18 text-white shadow-2xl"
        style={{ maxWidth: `${width / 10}rem`, maxHeight: "min(86svh, calc(100% - 3rem))" }}
      >
        <div className="flex items-start justify-between gap-15">
          <div>
            <p className="text-20 tracking-[-0.05em]">{title}</p>
            {subtitle ? <p className="mt-6 text-11 leading-15 text-white/42">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex size-32 shrink-0 items-center justify-center rounded-full bg-white/7 text-white/65"
          >
            <IconClose />
          </button>
        </div>
        <div className="mt-18">{children}</div>
      </div>
    </div>
  );
}

/* ── Auth gate (same experience as the template editor) ─────────────────── */

export function AuthGate({
  action,
  onSignIn,
  onClose,
}: {
  action: "save" | "publish";
  onSignIn: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title="Create your account"
      subtitle={
        action === "save"
          ? "Sign up with Google to save this project to your Paper Stish account."
          : "Sign up with Google to publish this website and create your personal link."
      }
      onClose={onClose}
    >
      <button
        type="button"
        onClick={onSignIn}
        className="flex h-48 w-full items-center justify-center gap-9 rounded-full bg-white text-13 text-black transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
      >
        Continue with Google
      </button>
      <p className="mt-12 text-center text-10 leading-14 text-white/32">
        Your project is kept safe as a local draft. An account is required to save or publish.
      </p>
    </ModalShell>
  );
}
