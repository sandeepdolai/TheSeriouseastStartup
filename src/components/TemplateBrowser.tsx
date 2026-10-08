"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { putLocalProject } from "@/lib/localProjects";
import { HomeCarousel } from "./HomeCarousel";
import { ProjectSheet } from "./ProjectSheet";
import { useFolio } from "@/gl/react";
import type { Project } from "@/lib/projects";
import type { AssetRecord, SmartEditDocument } from "./smartedit/types";

interface PublishedTemplate {
  id: string;
  slug: string;
  title: string;
  /** admin-written template description ("" for legacy templates) */
  description?: string | null;
  /** stored preview image (exact render or admin upload); null → the UI
   *  renders the document live, as it did before previews were stored */
  previewUrl?: string | null;
  document: SmartEditDocument;
  assets: Record<string, AssetRecord>;
  publishedAt: string;
}

interface Props {
  onOpenEditor: (projectId: string) => void;
}

export function TemplateBrowser({ onOpenEditor }: Props) {
  const folio = useFolio();
  const { data: session, status } = useSession();
  const [templates, setTemplates] = useState<PublishedTemplate[]>([]);
  const [selected, setSelected] = useState<PublishedTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"duplicate" | "save" | null>(null);
  const [error, setError] = useState("");

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load templates.");
      const data = (await res.json()) as { templates?: PublishedTemplate[] };
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const requireAccount = useCallback(() => {
    if (status === "authenticated" && session?.user?.email) return true;
    void signIn("google");
    return false;
  }, [session?.user?.email, status]);

  const duplicate = useCallback(async () => {
    if (!selected || !requireAccount()) return;
    setWorking("duplicate");
    setError("");

    try {
      const now = new Date().toISOString();
      const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ok = await putLocalProject({
        id,
        account: getAccountKey(session?.user?.email),
        title: selected.title,
        templateSlug: "smart-edit",
        createdAt: now,
        updatedAt: now,
        data: {
          kind: "smart-edit",
          sourceTemplateId: selected.id,
          document: selected.document,
          assets: selected.assets,
          published: null,
        },
      });

      if (!ok) throw new Error("Could not save the template copy on this device.");
      setSelected(null);
      onOpenEditor(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate this template.");
    } finally {
      setWorking(null);
    }
  }, [onOpenEditor, requireAccount, selected, session?.user?.email]);

  const saveTemplate = useCallback(() => {
    if (!selected || !requireAccount()) return;
    setWorking("save");
    setError("");

    try {
      const key = `paper-stish-saved-templates:${getAccountKey(session?.user?.email)}`;
      const raw = localStorage.getItem(key);
      const current = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(current) ? current : [];
      if (!list.some((item) => item?.id === selected.id)) {
        list.unshift({
          id: selected.id,
          slug: selected.slug,
          title: selected.title,
          savedAt: new Date().toISOString(),
        });
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch {
      setError("Could not save this template.");
    } finally {
      setWorking(null);
    }
  }, [requireAccount, selected, session?.user?.email]);

  const carouselProjects = useMemo<Project[]>(
    () =>
      templates.flatMap((template) => {
        const previewUrl =
          template.previewUrl ??
          Object.values(template.assets).find((asset) => typeof asset.url === "string" && asset.url)?.url;
        if (!previewUrl) return [];

        const width = template.document?.canvas?.width ?? 1;
        const height = template.document?.canvas?.height ?? 1;
        return [{
          title: template.title,
          slug: `template-${template.id}`,
          description:
            template.description?.trim() ||
            "Duplicate this design to make your own version in Smart Edit.",
          link: null,
          tags: [],
          awards: 0,
          aspect: width / height,
          media: [previewUrl],
        }];
      }),
    [templates],
  );

  const selectedProjectIndex = selected
    ? carouselProjects.findIndex((project) => project.slug === `template-${selected.id}`)
    : -1;
  const selectedProject =
    selectedProjectIndex >= 0 ? carouselProjects[selectedProjectIndex] : null;
  const relatedPrev =
    selectedProjectIndex >= 0 && carouselProjects.length > 1
      ? carouselProjects[(selectedProjectIndex - 1 + carouselProjects.length) % carouselProjects.length]
      : null;
  const relatedNext =
    selectedProjectIndex >= 0 && carouselProjects.length > 1
      ? carouselProjects[(selectedProjectIndex + 1) % carouselProjects.length]
      : null;

  const [swipe, setSwipe] = useState<{
    phase: "idle" | "drag" | "commit" | "cancel";
    direction: -1 | 1 | null;
    x: number;
  }>({ phase: "idle", direction: null, x: 0 });

  const selectProjectSlug = useCallback((slug: string) => {
    const template = templates.find((item) => `template-${item.id}` === slug);
    if (template) {
      setSelected(template);
      setSwipe({ phase: "idle", direction: null, x: 0 });
    }
  }, [templates]);

  const beginSwipe = useCallback((direction: -1 | 1) => {
    setSwipe({ phase: "drag", direction, x: 0 });
  }, []);

  const moveSwipe = useCallback((x: number) => {
    setSwipe((current) => current.phase === "drag" ? { ...current, x } : current);
  }, []);

  const cancelSwipe = useCallback(() => {
    setSwipe((current) => ({ ...current, phase: "cancel" }));
    window.setTimeout(() => setSwipe({ phase: "idle", direction: null, x: 0 }), 360);
  }, []);

  const commitSwipe = useCallback((direction: -1 | 1) => {
    if (selectedProjectIndex < 0 || carouselProjects.length < 2) {
      cancelSwipe();
      return;
    }
    setSwipe({ phase: "commit", direction, x: swipe.x });
    window.setTimeout(() => {
      const targetIndex =
        (selectedProjectIndex + (direction < 0 ? 1 : -1) + carouselProjects.length) %
        carouselProjects.length;
      selectProjectSlug(carouselProjects[targetIndex].slug);
      setSwipe({ phase: "idle", direction: null, x: 0 });
    }, 360);
  }, [cancelSwipe, carouselProjects, selectProjectSlug, selectedProjectIndex, swipe.x]);

  return (
    <>
      {folio && !loading && carouselProjects.length > 0 && (
        <HomeCarousel
          folio={folio}
          enabled={!selected}
          returning={null}
          onSelect={selectProjectSlug}
          hidden={false}
          projects={carouselProjects}
        />
      )}

      {loading && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center text-10 uppercase tracking-[0.08em] text-white/45">
          Loading templates
        </div>
      )}

      {error && (
        <div className="pointer-events-auto fixed left-1/2 top-1/2 z-[60] w-[min(34rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 rounded-16 border border-white/10 bg-black/85 px-18 py-15 text-center text-12 text-white backdrop-blur-xl">
          {error}
        </div>
      )}

      {!loading && !error && carouselProjects.length === 0 && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-25 text-center text-12 text-white/45">
          No published template previews are available yet.
        </div>
      )}

      {selected && selectedProject && (
        <ProjectSheet
          key={selected.id}
          project={selectedProject}
          mediaAspects={[selectedProject.aspect]}
          relatedPrev={relatedPrev}
          relatedNext={relatedNext}
          entered
          interactive={carouselProjects.length > 1}
          swipePhase={swipe.phase}
          swipeDirection={swipe.direction}
          swipeX={swipe.x}
          onSwipeStart={beginSwipe}
          onSwipeMove={moveSwipe}
          onSwipeCancel={cancelSwipe}
          onSwipeCommit={commitSwipe}
          onClose={() => {
            setSelected(null);
            setSwipe({ phase: "idle", direction: null, x: 0 });
          }}
          onPrev={selectProjectSlug}
          onNext={selectProjectSlug}
          actionContent={
            <div className="flex items-center gap-12">
              <button
                type="button"
                disabled={!!working}
                onClick={() => void duplicate()}
                className="flex size-48 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform duration-300 hover:scale-105 disabled:opacity-45"
                aria-label="Duplicate template"
                title="Duplicate template"
              >
                <svg viewBox="0 0 24 24" className="size-17" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="8" y="8" width="11" height="11" rx="2" />
                  <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button
                type="button"
                disabled={!!working}
                onClick={saveTemplate}
                className="h-48 rounded-full bg-black/[0.06] px-20 text-12 uppercase tracking-[0.04em] text-black transition-transform duration-300 hover:scale-[1.02] disabled:opacity-45"
              >
                {working === "save" ? "Saved" : "Save"}
              </button>
            </div>
          }
        />
      )}
    </>
  );
}
