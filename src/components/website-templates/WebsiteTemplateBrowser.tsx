"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { listLocalProjects, putLocalProject } from "@/lib/localProjects";
import { useFolio } from "@/gl/react";
import { WEBSITE_TEMPLATES } from "@/lib/projects";
import { HomeCarousel } from "../HomeCarousel";
import { ProjectSheet } from "../ProjectSheet";
import { WebsiteEditor, type WebsiteEditorTemplateSlug } from "./WebsiteEditor";

function isEditableSlug(slug: string): slug is WebsiteEditorTemplateSlug {
  return slug === "love-of-my-life" || slug === "birthday-template" || slug === "birthday-today" || slug === "photo-album" || slug === "love-heart" || slug === "forever-and-ever" || slug === "our-calendar";
}


async function ensureWebsiteDraft(slug: WebsiteEditorTemplateSlug, account: string): Promise<string> {
  const projects = await listLocalProjects(account);
  const existing = projects.find(
    (project) => project.templateSlug === slug && project.data?.kind === "website-template",
  );
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const id = `website-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const template = WEBSITE_TEMPLATES.find((item) => item.slug === slug);
  const saved = await putLocalProject({
    id,
    account,
    title: template?.title ?? slug,
    templateSlug: slug,
    createdAt: now,
    updatedAt: now,
    // Create the device-local record before opening the editor. The editor
    // fills in values/photos as the user works; nothing is sent to the server.
    data: { kind: "website-template" },
  });
  if (!saved) throw new Error("This draft could not be saved on this device.");
  return id;
}

/** Browse fixed website themes, preview one, then edit only its images and text. */
export function WebsiteTemplateBrowser({
  initialDraft = null,
  onDraftClose,
}: {
  initialDraft?: { id: string; templateSlug: WebsiteEditorTemplateSlug } | null;
  onDraftClose?: () => void;
} = {}) {
  const folio = useFolio();
  const { data: session, status } = useSession();
  const accountKey = getAccountKey(session?.user?.email);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<WebsiteEditorTemplateSlug | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isOpeningTemplate, setIsOpeningTemplate] = useState(false);
  const openingTemplate = useRef(false);

  const openWebsiteEditor = useCallback(async (slug: WebsiteEditorTemplateSlug) => {
    if (openingTemplate.current) return;
    openingTemplate.current = true;
    setIsOpeningTemplate(true);
    setDraftError("");
    try {
      const draftId = await ensureWebsiteDraft(slug, accountKey);
      setEditingDraftId(draftId);
      setEditingSlug(slug);
    } catch {
      setDraftError("Paper Stish could not save this draft on your device. Check your browser storage settings and try again.");
    } finally {
      openingTemplate.current = false;
      setIsOpeningTemplate(false);
    }
  }, [accountKey]);
  const [swipe, setSwipe] = useState<{
    phase: "idle" | "drag" | "commit" | "cancel";
    direction: -1 | 1 | null;
    x: number;
  }>({ phase: "idle", direction: null, x: 0 });

  // A draft opened from My must resume that exact local project, not just
  // the template's default state.
  useEffect(() => {
    if (initialDraft && isEditableSlug(initialDraft.templateSlug)) {
      setEditingDraftId(initialDraft.id);
      setEditingSlug(initialDraft.templateSlug);
      return;
    }
    // After Google sign-in, resume the exact website editor the user was in.
    const url = new URL(window.location.href);
    const requestedSlug = url.searchParams.get("edit");
    if (status === "loading") return;
    if (requestedSlug && isEditableSlug(requestedSlug)) {
      void openWebsiteEditor(requestedSlug);
    }
    if (url.searchParams.has("edit")) {
      url.searchParams.delete("edit");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [initialDraft, openWebsiteEditor, status]);

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

  if (editingSlug && editingDraftId) {
    return (
      <WebsiteEditor
        key={editingDraftId}
        templateSlug={editingSlug}
        draftProjectId={editingDraftId}
        onClose={() => {
          setEditingSlug(null);
          setEditingDraftId(null);
          if (initialDraft) onDraftClose?.();
        }}
      />
    );
  }

  return (
    <>
      {draftError && (
        <p role="alert" className="fixed left-20 right-20 top-70 z-[80] mx-auto max-w-[36rem] rounded-12 border border-white/15 bg-[#151515] px-16 py-12 text-12 leading-17 text-white">
          {draftError}
        </p>
      )}
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
            editableSlug ? (
              <button
                type="button"
                onClick={() => void openWebsiteEditor(editableSlug)}
                disabled={isOpeningTemplate || status === "loading"}
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
