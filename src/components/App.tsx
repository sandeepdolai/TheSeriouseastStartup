"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useFolio } from "@/gl/react";
import { FEATURED } from "@/lib/projects";
import { TemplateBrowser } from "./TemplateBrowser";
import { Hud } from "./Hud";
import { MyProjects } from "./MyProjects";
import { SmartEditEditor } from "./smartedit/SmartEditEditor";
import { type CanvasRatio, createDocument } from "./smartedit/types";
import { ProjectSheet } from "./ProjectSheet";
import { ProfileOverlay } from "./Overlays";
import { getAccountKey } from "@/lib/accountStorage";
import { isAdminEmail } from "@/lib/admin";
import { listLocalProjects, putLocalProject } from "@/lib/localProjects";

type View = "home" | "my" | "project" | "smart-edit";
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
    migrate("paper-stish-username");
  }, [accountEmail]);
  const [view, setView] = useState<View>("home");
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheetEntered, setSheetEntered] = useState(false);
  const [myEntered, setMyEntered] = useState(false);
  const [smartEditProjectId, setSmartEditProjectId] = useState<string | null>(null);
  const [carouselHidden, setCarouselHidden] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const [pendingAccountAction, setPendingAccountAction] = useState<
    { type: "create-smart-edit"; ratio: CanvasRatio } | null
  >(null);

  const busy = useRef(false);
  /** ONE Smart Edit open-or-create flow at a time. Rapid taps on either
   *  entry point (Profile → Smart Edit, My Projects → New Smart Edit) can
   *  never run concurrent flows — so they can never create duplicate
   *  project records (the project id is generated exactly once, inside
   *  this gate). */
  const smartEditAction = useRef(false);
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

  const wipeTo = useCallback(async (next: "my" | "home") => {
    if (busy.current) return;
    busy.current = true;
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView(next);
    setMyEntered(false);
    await wait(120);
    folio.closeHole();
    await wait(220);
    if (next === "my") setMyEntered(true);
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


  const openSmartEdit = useCallback(async (projectId: string) => {
    if (busy.current) return;
    busy.current = true;
    setSmartEditProjectId(projectId);
    folio.openHole(window.innerWidth / 2, window.innerHeight / 2);
    await wait(500);
    setView("smart-edit");
    setMyEntered(false);
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
      if (smartEditAction.current) return; // one creation at a time
      smartEditAction.current = true;
      try {
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
        await openSmartEdit(id);
      } finally {
        smartEditAction.current = false;
      }
    },
    [openSmartEdit, accountEmail],
  );

  const createAdminTemplate = useCallback(async () => {
    if (status !== "authenticated" || !isAdminEmail(accountEmail)) return;
    if (overlay) closeOverlay();
    const now = new Date().toISOString();
    const id = `template-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ok = await putLocalProject({
      id,
      account: getAccountKey(accountEmail),
      title: "New Template",
      templateSlug: "admin-template",
      createdAt: now,
      updatedAt: now,
      data: {
        kind: "smart-edit-template",
        document: createDocument("4:5"),
        assets: {},
      },
    });
    if (ok) await openSmartEdit(id);
  }, [accountEmail, closeOverlay, openSmartEdit, overlay, status]);

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
    if (smartEditAction.current) return; // rapid-tap guard: one flow at a time
    smartEditAction.current = true;
    if (overlay) closeOverlay();
    // Open the most recent Smart Edit project on this device, or start a
    // fresh one (device-first: no server round-trip). The gate is held for
    // the whole async flow, so repeated taps can neither open twice nor
    // create a second project while the first is still being created.
    void listLocalProjects(getAccountKey(accountEmail))
      .then((local) => {
        const smartProjects = local.filter(
          (item) => item.templateSlug === "smart-edit" && item.id,
        );
        // listLocalProjects is already newest-first (updatedAt/createdAt
        // descending) — the most recently updated project for this account.
        const localId = smartProjects[0]?.id ?? null;
        if (localId) {
          return openSmartEdit(localId).finally(() => {
            smartEditAction.current = false;
          });
        }
        // No Smart Edit project on this device yet: hand off to the SAME
        // creation path My Projects uses (it re-acquires the gate and holds
        // it through create + editor open — exactly one new project).
        smartEditAction.current = false;
        createSmartEdit("4:5");
      })
      .catch(() => {
        smartEditAction.current = false;
      });
  }, [accountEmail, closeOverlay, createSmartEdit, openSmartEdit, overlay]);

  const goHome = useCallback(() => {
    if (busy.current) return;
    if (overlay) closeOverlay();
    else if (view === "project") closeProject();
    else if (view === "smart-edit") closeSmartEdit();
    else if (view === "my") wipeTo("home");
  }, [view, overlay, closeOverlay, closeProject, closeSmartEdit, wipeTo]);

  const goMy = useCallback(() => {
    if (busy.current || (view !== "home" && view !== "my")) return;
    if (overlay) closeOverlay();
    wipeTo("my");
  }, [view, overlay, closeOverlay, wipeTo]);

  return (
    <>
      {view === "home" && !overlay && <TemplateBrowser onOpenEditor={openSmartEdit} />}

      {view === "my" && (
        <MyProjects
          entered={myEntered}
          onOpenProject={(projectId, templateSlug) => {
            if (templateSlug === "smart-edit") void openSmartEdit(projectId);
          }}
          onCreateSmartEdit={createSmartEdit}
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
                  Sign up with Google to create Smart Edit projects in your Paper Stish account.
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
              An account is required to create Smart Edit projects.
            </p>
          </div>
        </div>
      )}

      <ProfileOverlay
        open={overlay === "profile"}
        onMyProjects={goMy}
        onSmartEdit={smartEditQuickAction}
        onAdminTemplates={createAdminTemplate}
      />

      <Hud
        view={view}
        overlay={overlay}
        onProfile={() => toggleOverlay("profile")}
        onHome={goHome}
        onMy={goMy}
      />
    </>
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

