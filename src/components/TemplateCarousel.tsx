"use client";

import { useEffect, useRef } from "react";
import type { Folio, Rect } from "@/gl/scene";
import { loadCardTexture } from "@/gl/textures";
import { ease, tween, useFolio } from "@/gl/react";

export interface TemplateCarouselItem {
  id: string;
  title: string;
  previewUrl: string | null;
  aspect: number;
}

interface Props {
  templates: TemplateCarouselItem[];
  onSelect: (id: string) => void;
}

interface Item {
  el: HTMLElement;
  base: Rect;
  start: number;
  end: number;
  out: boolean;
  id: string;
}

const OVERSCAN = 0.5;
const DRAG_MULT = 1.5;
const FLING_MULT = 12;
const FLING_WINDOW = 100;
const MOVE_THRESHOLD = 10;

function wrap(min: number, max: number, value: number) {
  const range = max - min;
  if (range <= 0) return min;
  return ((((value - min) % range) + range) % range) + min;
}

export function TemplateCarousel({ templates, onSelect }: Props) {
  const folio = useFolio();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const scrollRef = useRef({ t: 0, a: 0 });
  const rangeRef = useRef(0);
  const alphaRef = useRef<Map<string, number>>(new Map());
  const lastFrameRef = useRef(performance.now());

  useEffect(() => {
    if (!folio) return;
    let disposed = false;
    const objectUrls: string[] = [];

    const boot = async () => {
      const track = trackRef.current;
      if (!track) return;

      for (const template of templates) {
        if (disposed) return;
        const el = track.querySelector<HTMLElement>(`[data-id="${CSS.escape(template.id)}"]`);
        if (!el || !template.previewUrl) continue;

        try {
          const tex = await loadCardTexture(template.previewUrl);
          if (disposed) {
            tex.dispose();
            return;
          }
          folio.registerCard(el, tex.texture, template.id, tex.size);
          alphaRef.current.set(template.id, 0);
        } catch {
          // A single failed thumbnail does not block the carousel.
        }
      }

      measure();

      const W = folio.frustum.W;
      const onScreen = itemsRef.current.filter((it) => {
        const r = it.el.getBoundingClientRect();
        return r.right > 0 && r.left < window.innerWidth;
      });

      onScreen.forEach((it, i) => {
        const entry = folio.cards.find((c) => c.slug === it.id);
        if (!entry) return;
        entry.ox = window.innerWidth < 650 ? 0 : (i % 2 === 0 ? -W * 0.5 : W * 0.5);
        tween(entry.ox, 0, 1.15, ease.expoOut, (v) => (entry.ox = v));
        tween(0, 1, 0.6, ease.power1Out, (v) => alphaRef.current.set(it.id, v));
      });

      folio.showGround(true);
      folio.showVeil(true);
    };

    boot();

    return () => {
      disposed = true;
      for (const template of templates) folio.removeCard(template.id);
      alphaRef.current.clear();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      folio.showGround(false);
      folio.showVeil(false);
      folio.setVelocity(0);
      folio.setScroll(0);
    };
  }, [folio, templates]);

  function measure() {
    const track = trackRef.current;
    if (!track) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const small = ww < 650;

    for (const el of Array.from(track.children) as HTMLElement[]) el.style.transform = "";

    const children = Array.from(track.children) as HTMLElement[];
    const items: Item[] = children.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        base: { left: r.left, top: r.top, width: r.width, height: r.height },
        start: small ? r.top - wh : r.left - ww,
        end: small ? r.bottom : r.right,
        out: true,
        id: el.dataset.id || "",
      };
    });

    itemsRef.current = items;
    const gap =
      parseFloat(
        small
          ? getComputedStyle(track).rowGap || "0"
          : getComputedStyle(track).columnGap || "0",
      ) || 0;

    if (items.length) {
      const first = items[0];
      const last = items[items.length - 1];
      rangeRef.current = small
        ? last.end + gap - (first.start + wh)
        : last.end + gap - (first.start + ww);
    } else {
      rangeRef.current = 0;
    }
  }

  function apply(a: number) {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const small = ww < 650;
    const viewport = small ? wh : ww;
    const overscan = viewport * OVERSCAN;

    for (const it of itemsRef.current) {
      const s = wrap(it.end - rangeRef.current, it.end, a);

      if (small) {
        const top = it.base.top - s;
        const inView = top + it.base.height > -overscan && top < wh + overscan;
        if (inView) {
          it.out = false;
          const vrect = (it.el as any)._vrect ?? {};
          vrect.left = it.base.left;
          vrect.top = top;
          vrect.width = it.base.width;
          vrect.height = it.base.height;
          (it.el as any)._vrect = vrect;
          it.el.style.transform = `translate3d(0px, ${-s}px, 0px)`;
        } else {
          it.out = true;
        }
      } else {
        const left = it.base.left - s;
        const inView = left + it.base.width > -overscan && left < ww + overscan;
        if (inView) {
          it.out = false;
          const vrect = (it.el as any)._vrect ?? {};
          vrect.left = left;
          vrect.top = it.base.top;
          vrect.width = it.base.width;
          vrect.height = it.base.height;
          (it.el as any)._vrect = vrect;
          it.el.style.transform = `translate3d(${-s}px, 0px, 0px)`;
        } else {
          it.out = true;
        }
      }
    }
  }

  useEffect(() => {
    if (!folio) return;

    const previous = folio.onFrame;
    folio.onFrame = (dt: number) => {
      previous?.(dt);

      const now = performance.now();
      lastFrameRef.current = now;

      const s = scrollRef.current;
      const ww = window.innerWidth;
      const small = ww < 650;
      const ratio = Math.min((dt * 60) / 1, 2);

      s.a += (s.t - s.a) * (0.1 * ratio);
      s.a = Math.round(s.a * 100) / 100;
      apply(s.a);

      if (small) folio.setScroll(s.t - s.a);
      else folio.setVelocity(s.t - s.a);

      for (const card of folio.cards) {
        const alpha = alphaRef.current.get(card.slug) ?? 0;
        const vrect = (card.el as any)._vrect as Rect | undefined;
        if (!vrect) continue;

        card.mesh.visible = alpha > 0.01;
        card.mesh.material.uniforms.u_alpha.value = alpha;

        const centerDist = Math.abs(vrect.left + vrect.width / 2 - ww / 2);
        const focus = Math.max(0, 1 - centerDist / (ww * 0.55));
        card.mesh.material.uniforms.u_scrim.value = focus * 0.75;
        folio.syncCard(card, vrect);
      }
    };

    return () => {
      folio.onFrame = previous;
    };
  }, [folio]);

  useEffect(() => {
    if (!folio) return;

    const onResize = () => {
      measure();
      apply(scrollRef.current.a);
    };

    window.addEventListener("resize", onResize);

    let down = false;
    let dragging = false;
    let last = 0;
    let velocity = 0;
    let lastMove = 0;
    let sx = 0;
    let sy = 0;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      scrollRef.current.t += event.deltaY + (event.deltaX || 0);
    };

    const onDown = (event: PointerEvent) => {
      if (down || event.button !== 0) return;
      down = true;
      dragging = false;
      sx = event.clientX;
      sy = event.clientY;
      last = window.innerWidth < 650 ? event.clientY : event.clientX;
      velocity = 0;
    };

    const onMove = (event: PointerEvent) => {
      if (!down) return;
      const small = window.innerWidth < 650;
      const current = small ? event.clientY : event.clientX;
      const primary = small ? Math.abs(event.clientY - sy) : Math.abs(event.clientX - sx);
      const cross = small ? Math.abs(event.clientX - sx) : Math.abs(event.clientY - sy);

      if (!dragging) {
        if (primary <= MOVE_THRESHOLD || primary <= cross) return;
        dragging = true;
        document.documentElement.classList.add("grabbing");
      }

      event.preventDefault();
      velocity = (last - current) * DRAG_MULT;
      lastMove = event.timeStamp;
      last = current;
      scrollRef.current.t += velocity;
    };

    const onUp = (event: PointerEvent) => {
      if (!down) return;
      down = false;
      document.documentElement.classList.remove("grabbing");

      if (dragging) {
        if (event.timeStamp - lastMove < FLING_WINDOW && velocity) {
          scrollRef.current.t += velocity * FLING_MULT;
        }
        dragging = false;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("grabbing");
    };
  }, [folio]);

  if (!folio || templates.length === 0) return null;

  return (
    <div ref={rootRef} className="fixed inset-0 z-10 overflow-hidden">
      <div
        ref={trackRef}
        className="absolute left-0 top-0 flex w-full flex-col gap-y-20 px-20 s:top-1/2 s:flex-row s:-translate-y-1/2 s:gap-x-10 s:px-0"
      >
        {templates.map((template) => (
          <article
            key={template.id}
            data-id={template.id}
            className="relative flex-none w-full cursor-pointer overflow-hidden rounded-15 bg-transparent s:h-[43.5svh] s:max-h-[55rem] s:w-auto s:rounded-20"
            style={{ aspectRatio: template.aspect || 1 }}
            onClick={() => onSelect(template.id)}
          />
        ))}
      </div>
    </div>
  );
}
