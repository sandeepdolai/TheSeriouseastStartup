"use client";

import { useCallback, useEffect, useState } from "react";
import { useFolio } from "@/gl/react";
import { WEBSITE_TEMPLATES } from "@/lib/projects";
import { HomeCarousel } from "../HomeCarousel";
import { ProjectSheet } from "../ProjectSheet";
import { WebsiteEditor, type WebsiteEditorTemplateSlug } from "./WebsiteEditor";

function isEditableSlug(slug: string): slug is WebsiteEditorTemplateSlug {
  return slug === "love-of-my-life" || slug === "birthday-template" || slug === "photo-album";
}

/** Browse fixed website themes, preview one, then edit only its images and text. */
export function WebsiteTemplateBrowser() {
  const folio = useFolio();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<WebsiteEditorTemplateSlug | null>(null);
  const [swipe, setSwipe] = useState<{
    phase: "idle" | "drag" | "commit" | "cancel";
    direction: -1 | 1 | null;
    x: number;
  }>({ phase: "idle", direction: null, x: 0 });

  // After Google sign-in, resume the exact website editor the user was in.
  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedSlug = url.searchParams.get("edit");
    if (requestedSlug && isEditableSlug(requestedSlug)) {
      setEditingSlug(requestedSlug);
    }
    if (url.searchParams.has("edit")) {
      url.searchParams.delete("edit");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, []);

  const selectedIndex = selectedSlug
    ? WEBSITE_TEMPLATES.findIndex((project) => project.slug === selectedSlug)
    : -1;
  const selected = selectedIndex >= 0 ? WEBSITE_TEMPLATES[selectedIndex] : null;
  const relatedPrev =
    selectedIndex >= 0 && WEBSITE_TEMPLATES.length > 1
      ? WEBSITE_TEMPLATES[(selectedIndex - 1 + WEBSITE_TEMPLATES.length) % WEBSITE_TEMPLATES.length]
      : null;
  const relatedNext =
    selectedIndex >= 0 && WEBSITE_TEMPLATES.length > 1
      ? WEBSITE_TEMPLATES[(selectedIndex + 1) % WEBSITE_TEMPLATES.length]
      : null;
  const editableSlug = selected && isEditableSlug(selected.slug) ? selected.slug : null;

  const selectProject = useCallback((slug: string) => {
    if (!WEBSITE_TEMPLATES.some((project) => project.slug === slug)) return;
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
      if (selectedIndex < 0 || WEBSITE_TEMPLATES.length < 2) {
        cancelSwipe();
        return;
      }
      setSwipe((current) => ({ ...current, phase: "commit", direction }));
      window.setTimeout(() => {
        const targetIndex =
          (selectedIndex + (direction < 0 ? 1 : -1) + WEBSITE_TEMPLATES.length) %
          WEBSITE_TEMPLATES.length;
        setSelectedSlug(WEBSITE_TEMPLATES[targetIndex].slug);
        setSwipe({ phase: "idle", direction: null, x: 0 });
      }, 360);
    },
    [cancelSwipe, selectedIndex],
  );

  if (editingSlug) {
    return <WebsiteEditor templateSlug={editingSlug} onClose={() => setEditingSlug(null)} />;
  }

  return (
    <>
      {folio && (
        <HomeCarousel
          folio={folio}
          enabled={!selected}
          returning={null}
          onSelect={selectProject}
          hidden={false}
          projects={WEBSITE_TEMPLATES}
        />
      )}

      {selected && (
        <ProjectSheet
          key={selected.slug}
          project={selected}
          relatedPrev={relatedPrev}
          relatedNext={relatedNext}
          relatedOnly
          entered
          interactive={WEBSITE_TEMPLATES.length > 1}
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
            editableSlug ? (
              <button
                type="button"
                onClick={() => setEditingSlug(editableSlug)}
                className="h-48 rounded-full bg-black px-20 text-12 uppercase tracking-[0.04em] text-white transition-transform duration-300 hover:scale-[1.02]"
              >
                Customize website
              </button>
            ) : (
              <p className="text-12 uppercase tracking-[0.04em] text-black/50">
                Website editor coming later
              </p>
            )
          }
        />
      )}
    </>
  );
}
