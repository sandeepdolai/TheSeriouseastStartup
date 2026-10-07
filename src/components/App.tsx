"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useFolio } from "@/gl/react";
import { FEATURED } from "@/lib/projects";
import { HomeCarousel } from "./HomeCarousel";
import { Hud } from "./Hud";
import { MyProjects } from "./MyProjects";
import { SavedTemplates } from "./SavedTemplates";
import { TemplateEditor } from "./TemplateEditor";
import { SmartEditEditor } from "./smartedit/SmartEditEditor";
import { type CanvasRatio, createDocument } from "./smartedit/types";
import { ProjectSheet } from "./ProjectSheet";
import { ProfileOverlay } from "./Overlays";
import { getAccountKey, getAccountStorageKey } from "@/lib/accountStorage";
import { listLocalProjects, putLocalProject } from "@/lib/localProjects";

type View = "home" | "my" | "project" | "saved" | "editor" | "smart-edit";
type Overlay = "profile" | null;

export function App() {
  const folio = useFolio();
  const { data: session, status } = useSession();
  const accountEmail = session?.user?.email ?? null;
  useEffect(() => {
    if (!accountEmail) return;

    const migrate = (key: string) => {
      const guestKey = `${key}:guest`;
      const accountKey = `${key}:${getAccountKey(accountEmail)}`;
      try {
        const guestRaw = localStorage.getItem(guestKey);
        if (!guestRaw) return;

        const guest = JSON.parse(guestRaw);
        const existingRaw = localStorage.getItem(accountKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];

        if (Array.isArray(guest)) {
          const merged = Array.isArray(existing) ? [...existing] : [];
          const existingIds = new Set(merged.map((item) => item?.id).filter(Boolean));
          for (const item of guest) {
            if (!item?.id || !existingIds.has(item.id)) merged.push(item);
          }
          localStorage.setItem(accountKey, JSON.stringify(merged));
        } else if (key === "paper-stish-username" && typeof guest === "string" && !existingRaw) {
          localStorage.setItem(accountKey, guest);
        }

        localStorage.removeItem(guestKey);
      } catch {
        // Keep anonymous data untouched if migration fails.
      }
    };

    // Projects live in the device-first IndexedDB store — account folding
    // (including legacy localStorage records) happens there on first read.
    migrate("paper-stish-templates");
    migrate("paper-stish-username");
  }, [accountEmail]);
  const [view, setView] = useState<View>("home");
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheetEntered, setSheetEntered] = useState(false);
  const [myEntered, setMyEntered] = useState(false);
  const [savedEntered, setSavedEntered] = useState(false);
  const [editorProjectId, setEditorProjectId] = useState<string | null>(null);
  const [editorTemplateSlug, setEditorTemplateSlug] = useState<string | null>(null);
  const [smartEditProjectId, setSmartEditProjectId] = useState<string | null>(null);
  const [carouselHidden, setCarouselHidden] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const [pendingAccountAction, setPendingAccountAction] = useState<
    | { type: "duplicate" | "save-template"; templateSlug: string }
    | { type: "create-smart-edit"; ratio: CanvasRatio }
    | null
  >(null);

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

  const wipeTo = useCallback(async (next: "my" | "home" | "saved") => {
    if (busy.current) return;
    busy.current = true;
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView(next);
    setMyEntered(false);
    setSavedEntered(false);
    await wait(120);
    folio.closeHole();
    await wait(220);
    if (next === "my") setMyEntered(true);
    if (next === "saved") setSavedEntered(true);
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


  const openTemplateEditor = useCallback(async (projectId: string, templateSlug: string) => {
    if (busy.current) return;
    busy.current = true;
    setEditorProjectId(projectId);
    setEditorTemplateSlug(templateSlug);
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView("editor");
    setMyEntered(false);
    setSavedEntered(false);
    folio.closeHole();
    await wait(220);
    busy.current = false;
  }, [folio]);

  const closeTemplateEditor = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(420);
    setView("my");
    setEditorProjectId(null);
    setEditorTemplateSlug(null);
    setMyEntered(false);
    folio.closeHole();
    await wait(220);
    setMyEntered(true);
    busy.current = false;
  }, [folio]);

  const openSmartEdit = useCallback(async (projectId: string) => {
    if (busy.current) return;
    busy.current = true;
    setSmartEditProjectId(projectId);
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView("smart-edit");
    setMyEntered(false);
    setSavedEntered(false);
    folio.closeHole();
    await wait(220);
    busy.current = false;
  }, [folio]);

  const closeSmartEdit = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(420);
    setView("my");
    setSmartEditProjectId(null);
    setMyEntered(false);
    folio.closeHole();
    await wait(220);
    setMyEntered(true);
    busy.current = false;
  }, [folio]);

  const performCreateSmartEdit = useCallback(
    async (ratio: CanvasRatio) => {
      const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();
      // One stable project id, created once, stored on this device.
      const ok = await putLocalProject({
        id,
        account: getAccountKey(accountEmail),
        title: "Smart Edit",
        templateSlug: "smart-edit",
        createdAt,
        updatedAt: createdAt,
        data: {
          kind: "smart-edit",
          document: createDocument(ratio),
          assets: {},
          published: null,
        },
      });
      if (!ok) return; // storage unavailable — do not open an empty editor
      void openSmartEdit(id);
    },
    [openSmartEdit, accountEmail],
  );

  const createSmartEdit = useCallback(
    (ratio: CanvasRatio) => {
      if (status !== "authenticated") {
        setPendingAccountAction({ type: "create-smart-edit", ratio });
        setAccountGateOpen(true);
        return;
      }
      void performCreateSmartEdit(ratio);
    },
    [performCreateSmartEdit, status],
  );

  const smartEditQuickAction = useCallback(() => {
    if (overlay) closeOverlay();
    // Open the most recent Smart Edit project on this device, or start a
    // fresh one (device-first: no server round-trip).
    void listLocalProjects(getAccountKey(accountEmail)).then((local) => {
      const smartProjects = local
        .filter((item) => item.templateSlug === "smart-edit" && item.id)
        .sort((a, b) =>
          String(b.updatedAt ?? b.createdAt ?? "").localeCompare(
            String(a.updatedAt ?? a.createdAt ?? ""),
          ),
        );
      const localId = smartProjects[0]?.id ?? null;
      if (localId) void openSmartEdit(localId);
      else void createSmartEdit("4:5");
    });
  }, [accountEmail, closeOverlay, createSmartEdit, openSmartEdit, overlay]);

  const performDuplicateTemplate = useCallback(async (template: (typeof FEATURED)[number]) => {
    const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Every duplicated project becomes an independent local project.
    const ok = await putLocalProject({
      id,
      account: getAccountKey(accountEmail),
      title: template.title,
      templateSlug: template.slug,
      thumbnail: template.media[0],
      createdAt: new Date().toISOString(),
    });
    if (!ok) return; // storage unavailable — do not open an empty editor
    void openTemplateEditor(id, template.slug);
  }, [openTemplateEditor, accountEmail]);

  const performSaveTemplate = useCallback((template: (typeof FEATURED)[number]) => {
    const templates = readLocalArray(getAccountStorageKey("paper-stish-templates", accountEmail));
    if (templates.some((item) => item.templateSlug === template.slug)) return;
    templates.unshift({
      id: `template-${template.slug}`,
      title: template.title,
      thumbnail: template.media[0],
      templateSlug: template.slug,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem(getAccountStorageKey("paper-stish-templates", accountEmail), JSON.stringify(templates));
  }, [accountEmail]);

  const duplicateTemplate = useCallback((template: (typeof FEATURED)[number]) => {
    if (status !== "authenticated") {
      setPendingAccountAction({ type: "duplicate", templateSlug: template.slug });
      setAccountGateOpen(true);
      return;
    }
    void performDuplicateTemplate(template);
  }, [performDuplicateTemplate, status]);

  const saveTemplate = useCallback((template: (typeof FEATURED)[number]) => {
    if (status !== "authenticated") {
      setPendingAccountAction({ type: "save-template", templateSlug: template.slug });
      setAccountGateOpen(true);
      return;
    }
    performSaveTemplate(template);
  }, [performSaveTemplate, status]);

  useEffect(() => {
    if (status !== "authenticated" || !pendingAccountAction) return;
    const action = pendingAccountAction;
    setPendingAccountAction(null);
    setAccountGateOpen(false);
    if (action.type === "duplicate") {
      const template = FEATURED.find((item) => item.slug === action.templateSlug);
      if (template) void performDuplicateTemplate(template);
    } else if (action.type === "save-template") {
      const template = FEATURED.find((item) => item.slug === action.templateSlug);
      if (template) void performSaveTemplate(template);
    } else if (action.type === "create-smart-edit") {
      void performCreateSmartEdit(action.ratio);
    }
  }, [pendingAccountAction, performDuplicateTemplate, performSaveTemplate, performCreateSmartEdit, status]);

  const goHome = useCallback(() => {
    if (busy.current) return;
    if (overlay) closeOverlay();
    else if (view === "project") closeProject();
    else if (view === "editor") closeTemplateEditor();
    else if (view === "smart-edit") closeSmartEdit();
    else if (view === "my" || view === "saved") wipeTo("home");
  }, [view, overlay, closeOverlay, closeProject, closeTemplateEditor, closeSmartEdit, wipeTo]);

  const goMy = useCallback(() => {
    if (busy.current || (view !== "home" && view !== "my")) return;
    if (overlay) closeOverlay();
    wipeTo("my");
  }, [view, overlay, closeOverlay, wipeTo]);

  const goSaved = useCallback(() => {
    if (busy.current || (view !== "home" && view !== "my")) return;
    if (overlay) closeOverlay();
    wipeTo("saved");
  }, [view, overlay, closeOverlay, wipeTo]);

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

      {view === "my" && (
        <MyProjects
          entered={myEntered}
          onOpenProject={(projectId, templateSlug) => {
            if (templateSlug === "smart-edit") void openSmartEdit(projectId);
            else if (templateSlug) void openTemplateEditor(projectId, templateSlug);
          }}
          onCreateSmartEdit={createSmartEdit}
        />
      )}

      {view === "saved" && <SavedTemplates entered={savedEntered} />}

      {view === "editor" && editorProjectId && editorTemplateSlug && (
        <TemplateEditor
          projectId={editorProjectId}
          templateSlug={editorTemplateSlug}
          onClose={closeTemplateEditor}
        />
      )}

      {view === "smart-edit" && smartEditProjectId && (
        <SmartEditEditor projectId={smartEditProjectId} onClose={closeSmartEdit} />
      )}

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

      {accountGateOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-15 backdrop-blur-[10px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAccountGateOpen(false);
              setPendingAccountAction(null);
            }
          }}
        >
          <div className="w-full max-w-[430px] rounded-[22px] border border-white/10 bg-[#121212] p-18 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-15">
              <div>
                <p className="text-20 tracking-[-0.05em]">Create your account</p>
                <p className="mt-6 text-11 leading-15 text-white/42">
                  {pendingAccountAction?.type === "create-smart-edit"
                    ? "Sign up with Google to create Smart Edit projects in your Paper Stish account."
                    : "Sign up with Google to duplicate or save templates to your Paper Stish account."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAccountGateOpen(false);
                  setPendingAccountAction(null);
                }}
                className="flex size-32 items-center justify-center rounded-full bg-white/7 text-white/65"
                aria-label="Close account sign-up dialog"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => signIn("google")}
              className="mt-22 flex h-48 w-full items-center justify-center gap-9 rounded-full bg-white text-13 text-black transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
            >
              Continue with Google
            </button>

            <p className="mt-12 text-center text-10 leading-14 text-white/32">
              You can browse templates without an account. An account is required to duplicate, save, or publish.
            </p>
          </div>
        </div>
      )}

      <ProfileOverlay
        open={overlay === "profile"}
        onMyProjects={goMy}
        onMyTemplates={goSaved}
        onSmartEdit={smartEditQuickAction}
      />

      <Hud
        view={view}
        overlay={overlay}
        onProfile={() => toggleOverlay("profile")}
        onSaved={goSaved}
        onHome={goHome}
        onMy={goMy}
      />
    </>
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
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
