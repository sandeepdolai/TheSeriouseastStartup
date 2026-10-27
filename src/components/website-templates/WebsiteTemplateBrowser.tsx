"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useFolio } from "@/gl/react";
import { getAccountKey } from "@/lib/accountStorage";
import { putLocalProject } from "@/lib/localProjects";
import { navigateToAppPath } from "@/lib/appRoutes";
import { WEBSITE_TEMPLATES } from "@/lib/projects";
import { HomeCarousel } from "../HomeCarousel";
import { ProjectSheet } from "../ProjectSheet";
import { WebsiteEditor, type WebsiteEditorTemplateSlug } from "./WebsiteEditor";

function isEditableSlug(slug: string): slug is WebsiteEditorTemplateSlug {
  return slug === "red-letter" || slug === "introducing-him" || slug === "love-of-my-life" || slug === "birthday-template" || slug === "birthday-today" || slug === "photo-album" || slug === "love-heart" || slug === "forever-and-ever" || slug === "our-calendar" || slug === "rose" || slug === "rose-blush" || slug === "rose-noir";
}

function rememberReturnPath(key: string, path: string): void {
  try {
    window.sessionStorage.setItem(key, path);
  } catch {
    // Deep links must still work if session storage is unavailable.
  }
}

function takeReturnPath(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
  } catch {
    return null;
  }
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
  const appliedRouteRef = useRef("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [selectedIsSaved, setSelectedIsSaved] = useState(false);
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
      setSelectedSlug(slug);
      setEditingProjectId(existingProjectId);
      setEditingSlug(slug);
      const currentUrl = new URL(window.location.href);
      if (!currentUrl.pathname.endsWith("/edit")) {
        rememberReturnPath(`paper-stish:return:website-edit:${existingProjectId}`, currentUrl.pathname + currentUrl.search);
      }
      const editPath = `/website-templates/${encodeURIComponent(slug)}/edit?draft=${encodeURIComponent(existingProjectId)}`;
      navigateToAppPath(editPath, currentUrl.pathname === `/website-templates/${slug}/edit` && !currentUrl.searchParams.has("draft"));
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
    setSelectedSlug(slug);
    setEditingProjectId(id);
    setEditingSlug(slug);
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.pathname.endsWith("/edit")) {
      rememberReturnPath(`paper-stish:return:website-edit:${id}`, currentUrl.pathname + currentUrl.search);
    }
    const incompleteEditRoute = currentUrl.pathname === `/website-templates/${slug}/edit` && !currentUrl.searchParams.has("draft");
    navigateToAppPath(
      `/website-templates/${encodeURIComponent(slug)}/edit?draft=${encodeURIComponent(id)}`,
      incompleteEditRoute || currentUrl.searchParams.has("edit"),
    );
  }, [session?.user?.email]);

  // Direct URLs and browser Back/Forward restore the selected template or exact
  // device-local draft. The URL contains only the draft id, never draft content.
  useEffect(() => {
    const applyRoute = () => {
      let url = new URL(window.location.href);
      const legacySlug = url.pathname === "/website-templates" ? url.searchParams.get("edit") : null;
      const legacyDraftId = url.searchParams.get("draft");
      if (legacySlug && isEditableSlug(legacySlug)) {
        const canonical = `/website-templates/${encodeURIComponent(legacySlug)}/edit${legacyDraftId ? `?draft=${encodeURIComponent(legacyDraftId)}` : ""}`;
        navigateToAppPath(canonical, true);
        url = new URL(window.location.href);
      }

      const key = url.pathname + url.search;
      if (appliedRouteRef.current === key) return;
      appliedRouteRef.current = key;

      const match = url.pathname.match(/^\/website-templates\/([^/]+)(\/edit)?\/?$/);
      let pathSlug: string | null = null;
      if (match?.[1]) {
        try {
          pathSlug = decodeURIComponent(match[1]);
        } catch {
          pathSlug = null;
        }
      }

      const requestedSlug = match?.[2] ? pathSlug : legacySlug;
      const requestedDraftId = url.searchParams.get("draft");
      if (requestedSlug && isEditableSlug(requestedSlug) && (match?.[2] || legacySlug)) {
        setSelectedSlug(requestedSlug);
        void beginEditing(requestedSlug, requestedDraftId ?? undefined);
        return;
      }

      const knownTemplate = pathSlug && WEBSITE_TEMPLATES.some((item) => item.slug === pathSlug);
      if (pathSlug && knownTemplate && !match?.[2]) {
        setEditingProjectId(null);
        setEditingSlug(null);
        setSelectedSlug(pathSlug);
        return;
      }

      if (
        url.pathname === "/website-templates" ||
        url.pathname === "/website-templates/" ||
        url.pathname === "/create/website-templates"
      ) {
        setEditingProjectId(null);
        setEditingSlug(null);
        setSelectedSlug(null);
      }
    };

    const handlePopState = () => {
      appliedRouteRef.current = "";
      applyRoute();
    };

    applyRoute();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [beginEditing]);

  // Opening a website project from My should resume that exact draft.
  useEffect(() => {
    if (!draftToOpen || !isEditableSlug(draftToOpen.templateSlug)) return;
    setDraftError("");
    setSelectedSlug(draftToOpen.templateSlug);
    setEditingProjectId(draftToOpen.projectId);
    setEditingSlug(draftToOpen.templateSlug);
    rememberReturnPath(
      `paper-stish:return:website-edit:${draftToOpen.projectId}`,
      window.location.pathname + window.location.search,
    );
    navigateToAppPath(
      `/website-templates/${encodeURIComponent(draftToOpen.templateSlug)}/edit?draft=${encodeURIComponent(draftToOpen.projectId)}`,
    );
    onDraftOpened?.();
  }, [draftToOpen, onDraftOpened]);

  const selectedIndex = selectedSlug
    ? WEBSITE_TEMPLATES.findIndex((project) => project.slug === selectedSlug)
    : -1;
  const selected = selectedIndex >= 0 ? WEBSITE_TEMPLATES[selectedIndex] : null;
  useEffect(() => {
    if (!selected) {
      setSelectedIsSaved(false);
      return;
    }

    try {
      const key = `paper-stish-saved-templates:${getAccountKey(session?.user?.email)}`;
      const raw = window.localStorage.getItem(key);
      const records = raw ? JSON.parse(raw) : [];
      setSelectedIsSaved(Array.isArray(records) && records.some((item) =>
        item && typeof item === "object" &&
        [item.id, item.slug, item.templateSlug].some((value) => value === selected.slug),
      ));
    } catch {
      setSelectedIsSaved(false);
    }
  }, [selected?.slug, session?.user?.email]);

  const saveTemplate = useCallback(() => {
    if (!selected) return;
    setDraftError("");

    try {
      const key = `paper-stish-saved-templates:${getAccountKey(session?.user?.email)}`;
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const records = Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
      const savedRecord = {
        id: selected.slug,
        slug: selected.slug,
        templateSlug: selected.slug,
        title: selected.title,
        thumbnail: selected.media[0],
        savedAt: new Date().toISOString(),
      };
      const existingIndex = records.findIndex((item) =>
        [item.id, item.slug, item.templateSlug].some((value) => value === selected.slug),
      );
      if (existingIndex >= 0) {
        records[existingIndex] = { ...records[existingIndex], ...savedRecord };
      } else {
        records.unshift(savedRecord);
      }
      window.localStorage.setItem(key, JSON.stringify(records));
      setSelectedIsSaved(true);
    } catch {
      setDraftError("Could not save this website template on this device.");
    }
  }, [selected, session?.user?.email]);

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
    const nextPath = `/website-templates/${encodeURIComponent(slug)}`;
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== nextPath) rememberReturnPath("paper-stish:return:website-preview", currentPath);
    setSelectedSlug(slug);
    setSwipe({ phase: "idle", direction: null, x: 0 });
    navigateToAppPath(nextPath);
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
        navigateToAppPath(`/website-templates/${encodeURIComponent(WEBSITE_TEMPLATES[targetIndex].slug)}`, true);
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
          const projectId = editingProjectId;
          const returnPath = projectId ? takeReturnPath(`paper-stish:return:website-edit:${projectId}`) : null;
          if (returnPath && window.history.length > 1) window.history.back();
          else if (editingSlug) navigateToAppPath(`/website-templates/${encodeURIComponent(editingSlug)}`, true);
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
            const returnPath = takeReturnPath("paper-stish:return:website-preview");
            if (returnPath && window.history.length > 1) window.history.back();
            else navigateToAppPath("/website-templates", true);
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
                <div className="flex flex-wrap items-center gap-12">
                  <button
                    type="button"
                    onClick={() => void beginEditing(editableSlug)}
                    className="flex size-48 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform duration-300 hover:scale-105"
                    aria-label="Duplicate website template"
                    title="Duplicate website template"
                  >
                    <svg viewBox="0 0 24 24" className="size-17" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="8" y="8" width="11" height="11" rx="2" />
                      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={saveTemplate}
                    disabled={selectedIsSaved}
                    className="h-48 rounded-full bg-black/[0.06] px-20 text-12 uppercase tracking-[0.04em] text-black transition-transform duration-300 hover:scale-[1.02] disabled:cursor-default disabled:opacity-55"
                  >
                    {selectedIsSaved ? "Saved" : "Save"}
                  </button>
                </div>
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
