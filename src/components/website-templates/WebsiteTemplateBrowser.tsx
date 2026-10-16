"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useFolio } from "@/gl/react";
import { getAccountKey } from "@/lib/accountStorage";
import { putLocalProject } from "@/lib/localProjects";
import { WEBSITE_TEMPLATES } from "@/lib/projects";
import { HomeCarousel } from "../HomeCarousel";
import { ProjectSheet } from "../ProjectSheet";
import { WebsiteEditor, type WebsiteEditorTemplateSlug } from "./WebsiteEditor";

function isEditableSlug(slug: string): slug is WebsiteEditorTemplateSlug {
  return slug === "love-of-my-life" || slug === "birthday-template" || slug === "birthday-today" || slug === "photo-album" || slug === "love-heart" || slug === "forever-and-ever" || slug === "our-calendar";
}

/** Browse fixed website themes, preview one, then edit only its images and text. */
export function WebsiteTemplateBrowser({
  draftToOpen = null,
  onDraftOpened,
}: {
  draftToOpen?: { projectId: string; templateSlug: string } | null;
  onDraftOpened?: () => void;
} = {}) {
  const folio = useFolio();
  const { data: session } = useSession();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<WebsiteEditorTemplateSlug | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [swipe, setSwipe] = useState<{
    phase: "idle" | "drag" | "commit" | "cancel";
    direction: -1 | 1 | null;
    x: number;
  }>({ phase: "idle", direction: null, x: 0 });

  // Every edit starts with a device-local project record before the editor
  // opens, so it is visible in My even if the user closes the tab immediately.
  const beginEditing = useCallback(async (slug: string, existingProjectId?: string) => {
    if (!isEditableSlug(slug)) return;

    if (existingProjectId) {
      setDraftError("");
      setEditingProjectId(existingProjectId);
      setEditingSlug(slug);
      return;
    }

    const template = WEBSITE_TEMPLATES.find((project) => project.slug === slug);
    const id = `website-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const saved = await putLocalProject({
      id,
      account: getAccountKey(session?.user?.email),
      title: template?.title ?? slug.replace(/-/g, " "),
      templateSlug: slug,
      thumbnail: template?.media[0],
      createdAt: now,
      updatedAt: now,
      data: { kind: "website-template" },
    });

    if (!saved) {
      setDraftError("This draft couldn't be saved on this device. Check your browser storage and try again.");
      return;
    }

    setDraftError("");
    setEditingProjectId(id);
    setEditingSlug(slug);
  }, [session?.user?.email]);

  // After Google sign-in, resume the same local project and open its publish
  // dialog, rather than creating a second draft.
  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedSlug = url.searchParams.get("edit");
    const requestedDraftId = url.searchParams.get("draft");
    if (requestedSlug && isEditableSlug(requestedSlug)) {
      void beginEditing(requestedSlug, requestedDraftId ?? undefined);
    }
    if (url.searchParams.has("edit") || url.searchParams.has("draft")) {
      url.searchParams.delete("edit");
      url.searchParams.delete("draft");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [beginEditing]);

  // Opening a website project from My should resume that exact draft.
  useEffect(() => {
    if (!draftToOpen || !isEditableSlug(draftToOpen.templateSlug)) return;
    setDraftError("");
    setEditingProjectId(draftToOpen.projectId);
    setEditingSlug(draftToOpen.templateSlug);
    onDraftOpened?.();
  }, [draftToOpen, onDraftOpened]);

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

  if (editingSlug && editingProjectId) {
    return (
      <WebsiteEditor
        templateSlug={editingSlug}
        projectId={editingProjectId}
        onClose={() => {
          setEditingProjectId(null);
          setEditingSlug(null);
        }}
      />
    );
  }

  return (
    <>
      {folio && WEBSITE_TEMPLATES.length > 0 && (
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
            <>
              {draftError && (
                <p role="alert" className="mb-10 max-w-[24rem] text-12 leading-16 text-red-600">
                  {draftError}
                </p>
              )}
              {editableSlug ? (
                <button
                  type="button"
                  onClick={() => void beginEditing(editableSlug)}
                  className="h-48 rounded-full bg-black px-20 text-12 uppercase tracking-[0.04em] text-white transition-transform duration-300 hover:scale-[1.02]"
                >
                  Customize website
                </button>
              ) : (
                <p className="text-12 uppercase tracking-[0.04em] text-black/50">
                  Website editor coming later
                </p>
              )}
            </>
          }
        />
      )}
    </>
  );
}
