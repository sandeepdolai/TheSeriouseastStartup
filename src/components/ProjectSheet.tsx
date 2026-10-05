"use client";

/* eslint-disable react-hooks/immutability */
import { useEffect, useRef, useState } from "react";
import { FEATURED, type Project } from "@/lib/projects";
import { ease, tween } from "@/gl/react";

interface Props {
  project: Project;
  onClose: () => void;
  onPrev: (slug: string) => void;
  onNext: (slug: string) => void;
  onDuplicate: (project: Project) => void;
  onSaveTemplate: (project: Project) => void;
  entered: boolean;
  incoming?: boolean;
  swipePhase?: "idle" | "drag" | "commit";
  swipeDirection?: -1 | 1 | null;
  swipeX?: number;
  interactive?: boolean;
  onSwipeStart?: (direction: -1 | 1) => void;
  onSwipeMove?: (x: number) => void;
  onSwipeCancel?: () => void;
  onSwipeCommit?: (direction: -1 | 1) => void;
}

const OVERSCAN = 0.25;
const DRAG_MULT = 1.5;
const FLING_MULT = 12;
const FLING_WINDOW = 100;
const MOVE_THRESHOLD = 10;

function wrap(min: number, max: number, value: number) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

function DuplicateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.1">
      <rect x="8" y="8" width="11" height="11" rx="1.8" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.1">
      <path d="M5 3h11l3 3v15H5z" strokeLinejoin="round" />
      <path d="M8 3v6h8V3M8 21v-6h8v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 40 28" className="h-28 w-40 text-[#d9a441]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 5h20v6a10 10 0 0 1-20 0V5z" strokeLinejoin="round" />
      <path d="M10 7H5a5 5 0 0 0 5 5M30 7h5a5 5 0 0 1-5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 21v-3M14 24h12" strokeLinecap="round" />
    </svg>
  );
}

const MEDIA_ASPECTS: Record<string, number[]> = {
  "nathan-riley": [2048 / 1172, 1787 / 900, 1798 / 905, 1792 / 904],
  "casa-di-solare": [2048 / 1204, 1280 / 596, 1280 / 644],
  "the-lookback": [1250 / 720, 1620 / 1080, 1500 / 1897, 1500 / 1000],
  "book-of-happiness": [2048 / 1114, 1565 / 908, 1568 / 906, 1571 / 906],
  "dogelon-mars": [3360 / 2200, 3360 / 2200, 3420 / 2201, 3360 / 2200],
  "gil-huybrecht": [1196 / 720, 1280 / 644, 1280 / 604],
  discoveryland: [1372 / 1029, 1280 / 642, 1280 / 642],
  griflan: [1162 / 720, 1022 / 720, 1280 / 642],
};

export function ProjectSheet({
  project,
  onClose,
  onPrev,
  onNext,
  onDuplicate,
  onSaveTemplate,
  entered,
  incoming = false,
  swipePhase = "idle",
  swipeDirection = null,
  swipeX = 0,
  interactive = false,
  onSwipeStart,
  onSwipeMove,
  onSwipeCancel,
  onSwipeCommit,
}: Props) {{
  const idx = FEATURED.findIndex((p) => p.slug === project.slug);
  const prev = FEATURED[(idx - 1 + FEATURED.length) % FEATURED.length];
  const next = FEATURED[(idx + 1) % FEATURED.length];

  const sheetRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef({ t: 0, a: 0 });
  const itemsRef = useRef<{ el: HTMLElement; base: { top: number; bottom: number } }[]>([]);
  const totalRef = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const swipeRef = useRef({
    active: false,
    horizontal: false,
    startX: 0,
    startY: 0,
    lastTime: 0,
    lastX: 0,
    velocityX: 0,
    pointerId: -1,
  });

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !interactive) return;

    const restore = () => {
      el.style.transition = "transform 320ms cubic-bezier(0.16,1,0.3,1)";
      el.style.transform = "translate3d(0,0,0)";
      window.setTimeout(() => {
        if (el) el.style.transition = "";
      }, 340);
      onSwipeCancel?.();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (swipePhase !== "idle") return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("button,a,input,textarea,select,[data-no-swipe]")) return;

      const s = swipeRef.current;
      s.active = true;
      s.horizontal = false;
      s.startX = event.clientX;
      s.startY = event.clientY;
      s.lastX = event.clientX;
      s.lastTime = performance.now();
      s.velocityX = 0;
      s.pointerId = event.pointerId;

      try { el.setPointerCapture(event.pointerId); } catch {}
    };

    const onPointerMove = (event: PointerEvent) => {
      const s = swipeRef.current;
      if (!s.active || s.pointerId !== event.pointerId) return;

      const dx = event.clientX - s.startX;
      const dy = event.clientY - s.startY;
      const now = performance.now();
      const dt = Math.max(8, now - s.lastTime);
      s.velocityX = (event.clientX - s.lastX) / dt;
      s.lastX = event.clientX;
      s.lastTime = now;

      if (!s.horizontal) {
        if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) return;

        if (Math.abs(dx) <= Math.abs(dy)) {
          s.active = false;
          s.pointerId = -1;
          try { el.releasePointerCapture(event.pointerId); } catch {}
          return;
        }

        s.horizontal = true;
        onSwipeStart?.(dx < 0 ? -1 : 1);
      }

      event.preventDefault();

      // The reference keeps the incoming sheet exactly one sheet-width
      // behind the finger-driven outgoing sheet, creating the continuous
      // "two cards handing off" motion.
      const bounded = Math.max(-window.innerWidth, Math.min(window.innerWidth, dx));
      onSwipeMove?.(bounded);
    };

    const onPointerUp = (event: PointerEvent) => {
      const s = swipeRef.current;
      if (!s.active || s.pointerId !== event.pointerId) return;

      s.active = false;
      try { el.releasePointerCapture(event.pointerId); } catch {}

      const dx = event.clientX - s.startX;
      const threshold = Math.max(76, Math.min(160, el.getBoundingClientRect().width * 0.22));
      const quickFlick = Math.abs(dx) > 58 && Math.abs(s.velocityX) > 0.8;

      if (s.horizontal && (Math.abs(dx) >= threshold || quickFlick)) {
        onSwipeCommit?.(dx < 0 ? -1 : 1);
      } else {
        restore();
      }

      s.pointerId = -1;
      s.horizontal = false;
    };

    const onPointerCancel = () => {
      const s = swipeRef.current;
      if (!s.active) return;
      s.active = false;
      s.horizontal = false;
      s.pointerId = -1;
      restore();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [interactive, onSwipeStart, onSwipeMove, onSwipeCancel, onSwipeCommit, swipePhase]);

  useEffect(() => {
    if (!entered) return;
    const t = setTimeout(() => setRevealed(true), 60);
    return () => clearTimeout(t);
  }, [entered, project.slug]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    const outer = media.parentElement;
    if (!outer) return;
    const children = Array.from(media.children) as HTMLElement[];
    for (const el of children) el.style.transform = "";
    const outerRect = outer.getBoundingClientRect();
    const items = children.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, base: { top: r.top - outerRect.top, bottom: r.bottom - outerRect.top } };
    });
    itemsRef.current = items;
    const gap = parseFloat(getComputedStyle(media).rowGap || "0") || 0;
    const first = items[0];
    if (items.length) {
      totalRef.current = items[items.length - 1].base.bottom + gap - first.base.top - outer.clientHeight;
    }
    apply(scrollRef.current.a, true);
  }, [project.slug]);

  function apply(a: number, force = false) {
    const media = mediaRef.current;
    const outer = media?.parentElement;
    if (!media || !outer) return;
    const h = outer.clientHeight;
    const l = h * OVERSCAN;
    for (const it of itemsRef.current) {
      const y = wrap(-(totalRef.current - it.base.bottom), it.base.bottom, a);
      const top = it.base.top - y;
      const inView = top + 200 > -l && top < h + l;
      if (inView || force) {
        it.el.style.transform = `translate3d(0px, ${-y}px, 0px)`;
        (it.el as any)._vrect = undefined;
        void top;
      }
    }
  }

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = scrollRef.current;
      const e = 0.1 * Math.min(dt * 60, 2);
      s.a += (s.t - s.a) * e;
      apply(s.a);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [project.slug]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const s = scrollRef.current;
      s.t += e.deltaY + (e.deltaX || 0);
    };

    let down = false;
    let dragging = false;
    let last = 0;
    let vel = 0;
    let lastMove = 0;
    let sy = 0;
    let sx = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = true;
      dragging = false;
      sy = e.clientY;
      sx = e.clientX;
      last = e.clientY;
      vel = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (!dragging) {
        const dy = Math.abs(e.clientY - sy);
        const dx = Math.abs(e.clientX - sx);
        if (dy <= MOVE_THRESHOLD || dy <= dx) return;
        dragging = true;
        document.documentElement.classList.add("grabbing");
      }
      e.preventDefault();
      const m = e.clientY;
      vel = (last - m) * DRAG_MULT;
      lastMove = e.timeStamp;
      last = m;
      if (vel) scrollRef.current.t += vel;
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      document.documentElement.classList.remove("grabbing");
      if (dragging) {
        if (e.timeStamp - lastMove < FLING_WINDOW && vel) scrollRef.current.t += vel * FLING_MULT;
        dragging = false;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.documentElement.classList.remove("grabbing");
    };
  }, []);

  const aspects = MEDIA_ASPECTS[project.slug] || project.media.map(() => 16 / 9);

  const reveal = (d: number) => ({
    style: {
      opacity: revealed ? 1 : 0,
      transform: revealed ? "translateY(0)" : "translateY(1rem)",
      transition: `opacity 0.85s cubic-bezier(0.16,1,0.3,1) ${d}s, transform 0.85s cubic-bezier(0.16,1,0.3,1) ${d}s`,
    },
  });

  const width = sheetRef.current?.getBoundingClientRect().width || window.innerWidth;
  const travel = Math.max(window.innerWidth, width);
  const sheetTransform = incoming
    ? swipeDirection === -1
      ? `translate3d(${travel + swipeX}px,0,0) scale(1)`
      : `translate3d(${-travel + swipeX}px,0,0) scale(1)`
    : `translate3d(${swipeX}px,0,0) scale(1)`;

  const sheetTransition =
    swipePhase === "commit"
      ? "transform 0.32s cubic-bezier(0.16,1,0.3,1)"
      : swipePhase === "drag"
        ? "none"
        : "none";

  const progress = Math.min(1, Math.abs(swipeX) / travel);
  const incomingShade = incoming
    ? swipePhase === "drag"
      ? Math.max(0.08, 1 - progress * 0.95)
      : swipePhase === "commit"
        ? 0
        : 1
    : 0;
  return (
    <>
      <div
        ref={sheetRef}
        data-id={project.slug}
        data-gl="sheet"
        className="fixed inset-y-15 s:inset-y-20 inset-x-20 s:inset-x-50 z-20 flex flex-col s:flex-row s:items-start gap-y-40 s:gap-x-100 overflow-hidden rounded-15 s:rounded-20 px-10 s:pt-40 s:pl-40 s:pr-120 bg-white will-change-transform"
        style={{
          opacity: entered ? 1 : 0,
          transform: sheetTransform,
          transition: sheetTransition,
          backgroundColor: "#fff",
          touchAction: interactive ? "pan-y" : undefined,
          cursor: interactive ? (swipePhase === "drag" ? "grabbing" : "grab") : undefined,
        }}
      >
        <div className="relative z-10 flex flex-col items-start s:flex-1 pt-40 s:pt-0 px-15 s:px-0">
          <h1 className="relative whitespace-nowrap text-35 s:text-45 font-normal leading-none tracking-[-0.05em] text-black" {...reveal(0.1)}>
            {project.title}
          </h1>
          <div className="mt-15 s:mt-20 max-w-[40rem] text-14 s:text-16 tracking-[-0.035em] text-black" {...reveal(0.22)}>
            {project.description}
          </div>
          <div className="mt-30 s:mt-45 flex items-start gap-8" {...reveal(0.34)}>
            <button type="button" onClick={() => onDuplicate(project)} className="relative inline-flex items-center rounded-full h-[2em] aspect-square justify-center px-2 bg-black text-white pointer-events-auto transition-transform duration-300 hover:scale-105" aria-label={"Duplicate " + project.title}>
              <DuplicateIcon className="size-[1.05em]" />
            </button>
            <button type="button" onClick={() => onSaveTemplate(project)} className="relative inline-flex items-center rounded-full h-[2em] px-[1.25em] bg-[#eee] text-black pointer-events-auto transition-colors duration-300 hover:bg-[#e2e2e2]" aria-label={"Save " + project.title + " to My Templates"}>
              <span className="label whitespace-nowrap">Save</span>
            </button>
          </div>
        </div>
        <div className="relative w-full flex-1 min-h-0 overflow-hidden s:w-auto s:flex-none s:h-full">
          <div ref={mediaRef} className="flex w-full flex-col items-center gap-y-30 s:gap-y-60 s:w-700 s:shrink-0 pb-80 has-hover:pb-0 will-change-transform">
            {project.media.map((m, i) => (
              <div key={`${project.slug}-${i}`} className="w-full flex-none overflow-hidden rounded-10 s:rounded-15" style={{ aspectRatio: `${aspects[i] ?? 16 / 9}` }}>
                {/\.(mp4|webm)$/i.test(m) ? (
                  <video src={m} className="h-full w-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img src={m} alt={`${project.title} — media ${i + 1}`} className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
        {incoming && swipePhase !== "idle" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 rounded-15 s:rounded-20 bg-[#b7b7b7]"
            style={{
              opacity: incomingShade,
              transition:
                swipePhase === "commit"
                  ? "opacity 0.32s cubic-bezier(0.16,1,0.3,1)"
                  : "none",
            }}
          />
        )}
        <div className="size-25 rounded-full border-2 border-solid border-black absolute bottom-15 left-15 s:bottom-30 s:left-30" />
        <button type="button" onClick={onClose} className="relative inline-flex items-center rounded-full h-[2em] aspect-square justify-center px-2 bg-black text-white pointer-events-auto !absolute !bottom-15 s:!bottom-auto s:!top-30 !right-15 s:!right-30 !size-40 s:!size-45 !p-0 transition-transform duration-300 hover:scale-105" aria-label="Close project">
          <CloseIcon className="size-[1.05em]" />
        </button>
      </div>

      <div className="invisible fixed inset-100 z-20 translate-x-[calc((100%+9rem)*-1)] s:translate-x-[calc((100%+7.5rem)*-1)] rounded-15 s:rounded-20 bg-white opacity-30" data-id={prev.slug} data-gl="related" style={{ visibility: entered ? "visible" : "hidden" }}>
        <button type="button" onClick={() => onPrev(prev.slug)} className="pointer-events-auto absolute inset-0 -right-25 cursor-pointer" aria-label={`Previous project: ${prev.title}`} />
      </div>
      <div className="invisible fixed inset-100 z-20 translate-x-[calc(100%+9rem)] s:translate-x-[calc(100%+7.5rem)] rounded-15 s:rounded-20 bg-white opacity-30" data-id={next.slug} data-gl="related" style={{ visibility: entered ? "visible" : "hidden" }}>
        <button type="button" onClick={() => onNext(next.slug)} className="pointer-events-auto absolute inset-0 -left-25 cursor-pointer" aria-label={`Next project: ${next.title}`} />
      </div>
    </>
  );
}
