"use client";

import { useCallback, useState } from "react";
import { useFolio } from "@/gl/react";
import { FEATURED } from "@/lib/projects";
import { HomeCarousel } from "../HomeCarousel";
import { ProjectSheet } from "../ProjectSheet";

/**
 * Website templates use the same immersive browsing and detail-sheet
 * architecture as Paper Stish's image templates. Editing and publishing
 * are intentionally not connected here; the website editor comes later.
 */
export function WebsiteTemplateBrowser() {
  const folio = useFolio();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{
    phase: "idle" | "drag" | "commit" | "cancel";
    direction: -1 | 1 | null;
    x: number;
  }>({ phase: "idle", direction: null, x: 0 });

  const selectedIndex = selectedSlug
    ? FEATURED.findIndex((project) => project.slug === selectedSlug)
    : -1;
  const selected = selectedIndex >= 0 ? FEATURED[selectedIndex] : null;
  const relatedPrev =
    selectedIndex >= 0 && FEATURED.length > 1
      ? FEATURED[(selectedIndex - 1 + FEATURED.length) % FEATURED.length]
      : null;
  const relatedNext =
    selectedIndex >= 0 && FEATURED.length > 1
      ? FEATURED[(selectedIndex + 1) % FEATURED.length]
      : null;

  const selectProject = useCallback((slug: string) => {
    if (!FEATURED.some((project) => project.slug === slug)) return;
    setSelectedSlug(slug);
    setSwipe({ phase: "idle", direction: null, x: 0 });
  }, []);

  const beginSwipe = useCallback((direction: -1 | 1) => {
    setSwipe({ phase: "drag", direction, x: 0 });
  }, []);

  const moveSwipe = useCallback((x: number) => {
    setSwipe((current) =>
      current.phase === "drag" ? { ...current, x } : current,
    );
  }, []);

  const cancelSwipe = useCallback(() => {
    setSwipe((current) => ({ ...current, phase: "cancel" }));
    window.setTimeout(
      () => setSwipe({ phase: "idle", direction: null, x: 0 }),
      360,
    );
  }, []);

  const commitSwipe = useCallback(
    (direction: -1 | 1) => {
      if (selectedIndex < 0 || FEATURED.length < 2) {
        cancelSwipe();
        return;
      }
      setSwipe((current) => ({
        ...current,
        phase: "commit",
        direction,
      }));
      window.setTimeout(() => {
        const targetIndex =
          (selectedIndex + (direction < 0 ? 1 : -1) + FEATURED.length) %
          FEATURED.length;
        setSelectedSlug(FEATURED[targetIndex].slug);
        setSwipe({ phase: "idle", direction: null, x: 0 });
      }, 360);
    },
    [cancelSwipe, selectedIndex],
  );

  return (
    <>
      {folio && (
        <HomeCarousel
          folio={folio}
          enabled={!selected}
          returning={null}
          onSelect={selectProject}
          hidden={false}
          projects={FEATURED}
        />
      )}

      {selected && (
        <ProjectSheet
          key={selected.slug}
          project={selected}
          relatedPrev={relatedPrev}
          relatedNext={relatedNext}
          entered
          interactive={FEATURED.length > 1}
          swipePhase={swipe.phase}
          swipeDirection={swipe.direction}
          swipeX={swipe.x}
          onSwipeStart={beginSwipe}
          onSwipeMove={moveSwipe}
          onSwipeCancel={cancelSwipe}
          onSwipeCommit={commitSwipe}
          onClose={() => {
            setSelectedSlug(null);
            setSwipe({ phase: "idle", direction: null, x: 0 });
          }}
          onPrev={selectProject}
          onNext={selectProject}
          actionContent={
            <p className="text-12 uppercase tracking-[0.04em] text-black/50">
              Website editor coming later
            </p>
          }
        />
      )}
    </>
  );
}
