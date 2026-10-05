"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFolio } from "@/gl/react";
import { FEATURED } from "@/lib/projects";
import { HomeCarousel } from "./HomeCarousel";
import { Hud } from "./Hud";
import { MyProjects, type EditorRatio } from "./MyProjects";
import { ImportView } from "./ImportView";
import { Editor } from "./Editor";
import { ProjectSheet } from "./ProjectSheet";
import { ProfileOverlay } from "./Overlays";

type View = "home" | "my" | "project" | "import" | "editor";
type Overlay = "profile" | null;

export function App() {
  const folio = useFolio();
  const [view, setView] = useState<View>("home");
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheetEntered, setSheetEntered] = useState(false);
  const [myEntered, setMyEntered] = useState(false);
  const [importEntered, setImportEntered] = useState(false);
  const [editorEntered, setEditorEntered] = useState(false);
  const [editorRatio, setEditorRatio] = useState<EditorRatio>("1:1");
  const [editorFileName, setEditorFileName] = useState<string | undefined>();
  const [carouselHidden, setCarouselHidden] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);

  const busy = useRef(false);
  const carouselApi = useRef<{ center: (slug: string) => void }>({ center: () => {} });

  const project = FEATURED.find((p) => p.slug === projectSlug) ?? null;
  const [swipe, setSwipe] = useState<{
    active: boolean;
    phase: "idle" | "drag" | "commit" | "cancel";
    direction: -1 | 1 | null;
    targetSlug: string | null;
    x: number;
  }>({ active: false, phase: "idle", direction: null, targetSlug: null, x: 0 });

  const adjacentSlug = useCallback((slug: string, direction: -1 | 1) => {
    const index = FEATURED.findIndex((item) => item.slug === slug);
    if (index < 0) return null;
    return FEATURED[
      (index + (direction < 0 ? 1 : -1) + FEATURED.length) % FEATURED.length
    ].slug;
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const desktopish = navigator.maxTouchPoints === 0 && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!mq && !desktopish) return;
    const onMove = (e: PointerEvent) => {
      folio.moveBall(e.clientX, e.clientY);
      folio.showBall(true);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      folio.showBall(false);
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [folio]);

  useEffect(() => {
    const scrollable = view === "home" && !overlay;
    document.documentElement.classList.toggle("grabbable", scrollable);
    return () => document.documentElement.classList.remove("grabbable");
  }, [view, overlay]);

  const toggleOverlay = useCallback((which: "profile") => {
    setOverlay((prev) => {
      const next = prev === which ? null : which;
      if (next) folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
      else folio.closeHole();
      return next;
    });
  }, [folio]);

  const closeOverlay = useCallback(() => {
    setOverlay((prev) => {
      if (prev) folio.closeHole();
      return null;
    });
  }, [folio]);

  const wipeTo = useCallback(async (next: "my" | "home" | "import") => {
    if (busy.current) return;
    busy.current = true;
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView(next);
    setMyEntered(false);
    setImportEntered(false);
    await wait(120);
    folio.closeHole();
    await wait(220);
    if (next === "my") setMyEntered(true);
    if (next === "import") setImportEntered(true);
    busy.current = false;
  }, [folio]);

  const openEditor = useCallback(async (ratio: EditorRatio, fileName?: string) => {
    if (busy.current) return;
    busy.current = true;
    setEditorRatio(ratio);
    setEditorFileName(fileName);
    setEditorEntered(false);
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView("editor");
    setMyEntered(false);
    setImportEntered(false);
    await wait(120);
    folio.closeHole();
    await wait(220);
    setEditorEntered(true);
    busy.current = false;
  }, [folio]);

  const closeEditor = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setEditorEntered(false);
    await wait(300);
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(420);
    setView("my");
    setEditorFileName(undefined);
    setMyEntered(false);
    folio.closeHole();
    await wait(220);
    setMyEntered(true);
    busy.current = false;
  }, [folio]);

  const openProject = useCallback(async (slug: string, fromCard: boolean) => {
    if (busy.current || overlay) return;
    busy.current = true;
    const entry = folio.cards.find((c) => c.slug === slug);
    if (fromCard && entry) {
      setCarouselHidden(true);
      const sheetRect = folio.sheetRect();
      let mounted = false;
      await folio.flyCard(slug, sheetRect, 1, (p) => {
        if (p > 0.45 && !mounted) {
          mounted = true;
          setView("project");
          setProjectSlug(slug);
                    setSheetEntered(true);
        }
      });
      if (!mounted) {
        setView("project");
        setProjectSlug(slug);
                setSheetEntered(true);
      }
      entry.mesh.visible = false;
      entry.flying = false;
    } else {
      folio.closeHole();
      setView("project");
      setProjectSlug(slug);
            setSheetEntered(false);
      await wait(60);
      setSheetEntered(true);
    }
    busy.current = false;
  }, [folio, overlay]);

  const closeProject = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const slug = projectSlug;
    setSheetEntered(false);
    await wait(260);
    setView("home");
    setProjectSlug(null);
        setReturning(slug);
    const entry = slug ? folio.cards.find((c) => c.slug === slug) : null;
    if (entry) {
      entry.mesh.visible = true;
      entry.flying = true;
      setCarouselHidden(false);
      await wait(80);
      carouselApi.current.center(slug);
      await folio.landCard(slug, 0.9);
    } else {
      setCarouselHidden(false);
    }
    setReturning(null);
    busy.current = false;
  }, [folio, projectSlug]);

  const switchProject = useCallback((slug: string) => {
    if (busy.current || slug === projectSlug) return;
    setProjectSlug(slug);
    setSwipe({ active: false, phase: "idle", direction: null, targetSlug: null, x: 0 });
    setSheetEntered(true);
  }, [projectSlug]);

  const beginSheetSwipe = useCallback((direction: -1 | 1) => {
    if (busy.current || !projectSlug || swipe.active) return;
    const targetSlug = adjacentSlug(projectSlug, direction);
    if (!targetSlug) return;
    setSwipe({ active: true, phase: "drag", direction, targetSlug, x: 0 });
  }, [adjacentSlug, projectSlug, swipe.active]);

  const moveSheetSwipe = useCallback((x: number) => {
    if (!swipe.active) return;
    setSwipe((s) => ({ ...s, x }));
  }, [swipe.active]);

  const cancelSheetSwipe = useCallback(() => {
    if (!swipe.active || busy.current) return;
    setSwipe((s) => ({ ...s, phase: "cancel" }));
    window.setTimeout(() => {
      setSwipe({ active: false, phase: "idle", direction: null, targetSlug: null, x: 0 });
    }, 360);
  }, [swipe.active]);

  const commitSheetSwipe = useCallback((direction: -1 | 1) => {
    if (!swipe.active || swipe.phase !== "drag" || swipe.direction !== direction || !swipe.targetSlug || busy.current) return;
    busy.current = true;
    const targetSlug = swipe.targetSlug;
    setSwipe((s) => ({ ...s, phase: "commit" }));
    window.setTimeout(() => {
      setProjectSlug(targetSlug);
      setSwipe({ active: false, phase: "idle", direction: null, targetSlug: null, x: 0 });
      busy.current = false;
    }, 360);
  }, [swipe]);

  const duplicateTemplate = useCallback((template: (typeof FEATURED)[number]) => {
    const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const projects = readLocalArray("paper-stish-projects");
    projects.unshift({
      id,
      title: template.title,
      thumbnail: template.media[0],
      templateSlug: template.slug,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("paper-stish-projects", JSON.stringify(projects));
    void openEditor("1:1");
  }, [openEditor]);

  const saveTemplate = useCallback((template: (typeof FEATURED)[number]) => {
    const templates = readLocalArray("paper-stish-templates");
    if (templates.some((item) => item.templateSlug === template.slug)) return;
    templates.unshift({
      id: `template-${template.slug}`,
      title: template.title,
      thumbnail: template.media[0],
      templateSlug: template.slug,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem("paper-stish-templates", JSON.stringify(templates));
  }, []);

  const goHome = useCallback(() => {
    if (busy.current) return;
    if (overlay) closeOverlay();
    else if (view === "project") closeProject();
    else if (view === "editor") closeEditor();
    else if (view === "my" || view === "import") wipeTo("home");
  }, [view, overlay, closeOverlay, closeProject, closeEditor, wipeTo]);

  const goMy = useCallback(() => {
    if (busy.current || view !== "home" || overlay) return;
    wipeTo("my");
  }, [view, overlay, wipeTo]);

  const goImport = useCallback(() => {
    if (busy.current || overlay || (view !== "home" && view !== "my")) return;
    wipeTo("import");
  }, [view, overlay, wipeTo]);

  return (
    <>
      <HomeCarousel
        folio={folio}
        enabled={view === "home" && !overlay}
        returning={returning}
        hidden={carouselHidden || view !== "home"}
        onSelect={(slug) => openProject(slug, true)}
        apiRef={carouselApi}
      />

      {view === "my" && <MyProjects entered={myEntered} />}

      {view === "import" && <ImportView entered={importEntered} onClose={goHome} onImport={(fileName) => openEditor("1:1", fileName)} />}

      {view === "editor" && <Editor entered={editorEntered} ratio={editorRatio} importedFileName={editorFileName} onClose={closeEditor} />}

      {view === "project" && project && swipe.active && swipe.targetSlug && (
        <ProjectSheet
          key={`incoming-${swipe.targetSlug}`}
          project={FEATURED.find((item) => item.slug === swipe.targetSlug)!}
          entered
          incoming
          swipePhase={swipe.phase}
          swipeDirection={swipe.direction!}
          swipeX={swipe.x}
          onClose={closeProject}
          onPrev={(slug) => switchProject(slug)}
          onNext={(slug) => switchProject(slug)}
          onDuplicate={duplicateTemplate}
          onSaveTemplate={saveTemplate}
        />
      )}

      {view === "project" && project && (
        <ProjectSheet
          key={`current-${project.slug}`}
          project={project}
          entered={sheetEntered}
          swipePhase={swipe.phase}
          swipeDirection={swipe.direction}
          swipeX={swipe.x}
          onSwipeStart={beginSheetSwipe}
          onSwipeMove={moveSheetSwipe}
          onSwipeCancel={cancelSheetSwipe}
          onSwipeCommit={commitSheetSwipe}
          onClose={closeProject}
          onPrev={(slug) => switchProject(slug)}
          onNext={(slug) => switchProject(slug)}
          onDuplicate={duplicateTemplate}
          onSaveTemplate={saveTemplate}
          interactive
        />
      )}

      <ProfileOverlay open={overlay === "profile"} />

      <Hud
        view={view}
        overlay={overlay}
        onProfile={() => toggleOverlay("profile")}
        onImport={goImport}
        onHome={goHome}
        onMy={goMy}
      />
    </>
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function readLocalArray(key: string): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
