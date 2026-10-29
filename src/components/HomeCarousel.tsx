"use client";

/* eslint-disable react-hooks/immutability */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Folio, Rect } from "@/gl/scene";
import { loadCardTexture } from "@/gl/textures";
import { ease, tween } from "@/gl/react";
import { FEATURED, type Project } from "@/lib/projects";

interface Item {
  el: HTMLElement;
  base: Rect;
  start: number;
  end: number;
  out: boolean;
  slug: string;
}

interface Props {
  folio: Folio;
  enabled: boolean;
  returning: string | null;
  onSelect: (slug: string) => void;
  hidden: boolean;
  apiRef?: React.MutableRefObject<{ center: (slug: string) => void }>;
  /** Uses the same immersive carousel for dynamically loaded template cards. */
  projects?: Project[];
}

const OVERSCAN = 0.5;
const DRAG_MULT = 1.5;
const FLING_MULT = 12;
const FLING_WINDOW = 100;
const MOVE_THRESHOLD = 10;

function wrap(min: number, max: number, value: number) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

export function HomeCarousel({ folio, enabled, returning, onSelect, hidden, apiRef, projects = FEATURED }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const scrollRef = useRef({ t: 0, a: 0 });
  const rangeRef = useRef(0);
  const hoverRef = useRef<Map<string, { v: number; target: number }>>(new Map());
  const alphaRef = useRef<Map<string, number>>(new Map());
  const bootedRef = useRef(false);
  const lastFrameRef = useRef(performance.now());

  const registerFrame = useRef(false);

  useEffect(() => {
    let disposed = false;

    const boot = async () => {
      const track = trackRef.current;
      if (!track) return;

      // load textures + register GL cards
      for (const p of projects) {
        if (disposed) return;
        const el = track.querySelector<HTMLElement>(`[data-id="${p.slug}"]`);
        if (!el) continue;
        try {
          const tex = await loadCardTexture(p.media[0]);
          if (disposed) {
            tex.dispose();
            return;
          }
          folio.registerCard(el, tex.texture, p.slug, tex.size);
          alphaRef.current.set(p.slug, 0);
        } catch {
          // ignore — card just won't render
        }
      }

      measure();

      // rise-in choreography
      const W = folio.frustum.W;
      const retIdx = returning ? projects.findIndex((p) => p.slug === returning) : -1;
      const retEl = retIdx >= 0 ? itemsRef.current[retIdx]?.el : null;
      const retLeft = retEl ? retEl.getBoundingClientRect().left : null;

      const onScreen = itemsRef.current.filter((it) => {
        const r = it.el.getBoundingClientRect();
        return r.right > 0 && r.left < window.innerWidth;
      });
      const withDist = onScreen.map((it) => ({
        it,
        d: retLeft === null ? 0 : it.el.getBoundingClientRect().left - retLeft,
      }));
      withDist.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));

      withDist.forEach(({ it, d }, i) => {
        const entry = folio.cards.find((c) => c.slug === it.slug);
        if (!entry) return;
        entry.ox = window.innerWidth < 650 ? 0 : Math.sign(d || 1) * W * 0.5;
        const delay = 0.1 + i * 0.05;
        tween(entry.ox, 0, 1.25, ease.expoOut, (v) => (entry.ox = v));
        const a0 = alphaRef.current.get(it.slug) ?? 0;
        tween(a0, 1, 0.625, ease.power1Out, (v) => alphaRef.current.set(it.slug, v));
        void delay;
      });

      folio.showGround(true);
      folio.showVeil(true);
      bootedRef.current = true;
    };

    boot();

    return () => {
      disposed = true;
      for (const p of projects) folio.removeCard(p.slug);
      folio.showGround(false);
      folio.showVeil(false);
      folio.setVelocity(0);
    };
     
  }, [folio, projects]);

  function measure() {
    const track = trackRef.current;
    if (!track) return;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const small = ww < 650;
    const children = Array.from(track.children) as HTMLElement[];
    for (const el of children) el.style.transform = "";
    const items: Item[] = children.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        base: { left: r.left, top: r.top, width: r.width, height: r.height },
        start: small ? r.top - wh : r.left - ww,
        end: small ? r.bottom : r.right,
        out: true,
        slug: el.dataset.id || "",
      };
    });
    itemsRef.current = items;
    const gap = parseFloat(
      small ? getComputedStyle(track).rowGap || "0" : getComputedStyle(track).columnGap || "0"
    ) || 0;
    const first = items[0];
    if (items.length) {
      const last = items[items.length - 1];
      rangeRef.current = small
        ? last.end + gap - (first.start + wh)
        : last.end + gap - (first.start + ww);
    }
  }

  /** center a given card in the viewport (used when returning from a project) */
  const center = (slug: string) => {
    measure();
    const ww = window.innerWidth;
    const it = itemsRef.current.find((i) => i.slug === slug);
    if (!it) return;
    const a = (it.start + ww + it.end) / 2 - ww / 2;
    scrollRef.current.t = a;
    scrollRef.current.a = a;
    apply(a, true);
  };

  useEffect(() => {
    if (apiRef) apiRef.current.center = center;
     
  }, [apiRef]);

  // measure on resize
  useEffect(() => {
    const onResize = () => {
      measure();
      // reapply current scroll
      apply(scrollRef.current.a, true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
     
  }, []);

  function apply(a: number, force = false) {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const small = ww < 650;
    const viewport = small ? wh : ww;
    const l = viewport * OVERSCAN;
    for (const it of itemsRef.current) {
      const s = wrap(it.end - rangeRef.current, it.end, a);
      if (small) {
        const top = it.base.top - s;
        const inView = top + it.base.height > -l && top < wh + l;
        if (inView || force) {
          it.out = false;
          const vrect = (it.el as any)._vrect ?? {};
          vrect.left = it.base.left;
          vrect.top = top;
          vrect.width = it.base.width;
          vrect.height = it.base.height;
          (it.el as any)._vrect = vrect;
          it.el.style.transform = `translate3d(0px, ${-s}px, 0px)`;
        } else if (it.out) {
          continue;
        } else {
          it.out = true;
        }
      } else {
        const left = it.base.left - s;
        const inView = left + it.base.width > -l && left < ww + l;
        if (inView || force) {
          it.out = false;
          const vrect = (it.el as any)._vrect ?? {};
          vrect.left = left;
          vrect.top = it.base.top;
          vrect.width = it.base.width;
          vrect.height = it.base.height;
          (it.el as any)._vrect = vrect;
          it.el.style.transform = `translate3d(${-s}px, 0px, 0px)`;
        } else if (it.out) {
          continue;
        } else {
          it.out = true;
        }
      }
    }
  }

  // frame loop — drives scroll physics + mesh sync
  useEffect(() => {
    const prev = folio.onFrame;
    folio.onFrame = (dt: number) => {
      prev?.(dt);
      if (!registerFrame.current) registerFrame.current = true;
      const now = performance.now();
      void now;
      lastFrameRef.current = now;

      const s = scrollRef.current;
      const ww = window.innerWidth;
      const small = ww < 650;

      // lerp
      const ratio = Math.min((dt * 60) / 1, 2);
      const e = 0.1 * ratio;
      s.a = s.a + (s.t - s.a) * e;
      s.a = Math.round(s.a * 100) / 100;

      if (enabled && !hidden) {
        apply(s.a);
        if (small) {
          folio.setScroll(s.t - s.a);
        } else {
          folio.setVelocity(s.t - s.a);
        }
      }

      // hover + alpha + sync meshes
      for (const c of folio.cards) {
        if (c.flying) continue;
        const h = hoverRef.current.get(c.slug);
        const target = h ? h.target : 0;
        if (c.hover !== target) {
          c.hover += (target - c.hover) * Math.min(1, dt * 6);
          if (Math.abs(c.hover - target) < 0.001) c.hover = target;
        }
        c.mesh.material.uniforms.u_hover.value = c.hover;
        const alpha = alphaRef.current.get(c.slug) ?? 0;
        const vrect = (c.el as any)._vrect as Rect | undefined;
        if (vrect) {
          c.mesh.visible = alpha > 0.01;
          if (hidden) {
            c.mesh.material.uniforms.u_alpha.value = alpha * 0;
          } else {
            c.mesh.material.uniforms.u_alpha.value = alpha;
          }
          // scrim follows title visibility (cards near center)
          const centerDist = Math.abs(vrect.left + vrect.width / 2 - ww / 2);
          const titleA = Math.max(0, 1 - centerDist / (ww * 0.55));
          c.mesh.material.uniforms.u_scrim.value = titleA * 0.9;
          folio.syncCard(c, vrect);
        }
      }
    };
    return () => {
      folio.onFrame = undefined;
    };
  }, [folio, enabled, hidden]);

  // wheel + drag
  useEffect(() => {
    if (!enabled) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const s = scrollRef.current;
      const ww = window.innerWidth;
      s.t += e.deltaY + (e.deltaX || 0);
      const lim = ww * 1;
      const l = s.t - s.a;
      s.t = s.a + Math.tanh(l / lim) * lim;
    };

    let down = false;
    let dragging = false;
    let last = 0;
    let vel = 0;
    let lastMove = 0;
    let sx = 0;
    let sy = 0;

    const onDown = (e: PointerEvent) => {
      if (down || e.button !== 0 || e.pointerType !== "mouse") return;
      down = true;
      dragging = false;
      sx = e.clientX;
      sy = e.clientY;
      last = e.clientX;
      vel = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const ww = window.innerWidth;
      if (ww < 650) return;
      if (!dragging) {
        const dx = Math.abs(e.clientX - sx);
        const dy = Math.abs(e.clientY - sy);
        if (dx <= MOVE_THRESHOLD || dx <= dy) return;
        dragging = true;
        document.documentElement.classList.add("grabbing");
      }
      e.preventDefault();
      const m = e.clientX;
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
        if (e.timeStamp - lastMove < FLING_WINDOW && vel) {
          scrollRef.current.t += vel * FLING_MULT;
        }
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
  }, [enabled]);

  // mobile touch scroll (vertical column)
  useEffect(() => {
    if (!enabled) return;
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
      const ww = window.innerWidth;
      if (ww >= 650) return;
      if (!dragging) {
        const dy = Math.abs(e.clientY - sy);
        const dx = Math.abs(e.clientX - sx);
        if (dy <= MOVE_THRESHOLD || dy <= dx) return;
        dragging = true;
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
      if (dragging) {
        if (e.timeStamp - lastMove < FLING_WINDOW && vel) {
          scrollRef.current.t += vel * FLING_MULT;
        }
        dragging = false;
      }
    };

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled]);

  const hoverCard = (slug: string, on: boolean) => {
    if (!hoverRef.current.has(slug)) hoverRef.current.set(slug, { v: 0, target: 0 });
    hoverRef.current.get(slug)!.target = on ? 1 : 0;
  };

  return (
    <div ref={rootRef} className="fixed inset-0 overflow-hidden" style={{ display: hidden ? "none" : undefined }}>
      <div className="sr-only">
        <h1>
          {SITE_NAME} — {SITE_ROLE}
        </h1>
        <p>{SITE_SUMMARY}</p>
        <p>{SITE_ABOUT}</p>
        <p>{SITE_AWARDS}</p>
        <h2>Featured work</h2>
        <ul>
          {projects.map((p: Project) => (
            <li key={p.slug}>
              <a href={`#project-${p.slug}`}>{p.title}</a> — {p.description}
            </li>
          ))}
        </ul>
        <h2>Paper Stish</h2>
        <ul>
          <li>Browse personal website ideas</li>
          <li>Newsletter sign-ups (currently unavailable)</li>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="mailto:sandeepdolai.info@gmail.com">Support</a></li>
        </ul>
      </div>

      <div
        ref={trackRef}
        className="absolute w-full left-0 top-0 s:top-1/2 flex flex-col s:flex-row s:-translate-y-1/2 gap-y-20 s:gap-x-10 px-20 s:px-0"
      >
        {projects.map((p) => (
          <article
            key={p.slug}
            data-id={p.slug}
            data-gl="card"
            className="relative w-full s:h-[43.5svh] s:max-h-[55rem] s:w-auto flex-none cursor-pointer rounded-15 s:rounded-20 bg-transparent"
            style={{ aspectRatio: `${p.aspect}` }}
            onPointerEnter={() => hoverCard(p.slug, true)}
            onPointerLeave={() => hoverCard(p.slug, false)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return;
              onSelect(p.slug);
            }}
          >
            <p className="pointer-events-none absolute bottom-10 inset-x-10 s:bottom-10 s:inset-x-20 flex items-end justify-between">
              <span className="whitespace-nowrap text-16 s:text-18 tracking-[-0.05em]" data-title="">
                {p.title}
              </span>
              <span
                className="relative inline-flex size-25 s:size-25 items-center justify-center rounded-full bg-black text-white transition-opacity duration-300"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="size-15" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

import { SITE } from "@/lib/projects";
const { name: SITE_NAME, role: SITE_ROLE, summary: SITE_SUMMARY, about: SITE_ABOUT, awards: SITE_AWARDS } = SITE;
