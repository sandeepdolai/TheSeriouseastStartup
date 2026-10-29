"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { listLocalProjects } from "@/lib/localProjects";
import { SmartEditPreview } from "./smartedit/SmartEditPreview";
import { CANVAS_RATIOS, type AssetRecord, type CanvasRatio, type SmartEditDocument } from "./smartedit/types";

interface Props {
  entered: boolean;
  onOpenProject?: (projectId: string, templateSlug: string) => void;
  onCreateSmartEdit?: (ratio: CanvasRatio) => void;
}

export type EditorRatio = "9:16" | "16:9" | "4:5" | "1:1";

interface LocalProject {
  id: string;
  title: string;
  thumbnail?: string;
  updatedAt?: string;
  templateSlug?: string;
  data?: {
    kind?: string;
    document?: SmartEditDocument;
    assets?: Record<string, AssetRecord>;
  };
}

export function MyProjects({ entered, onOpenProject, onCreateSmartEdit }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [ratioPanelOpen, setRatioPanelOpen] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const key = "paper-stish:scroll:/create/my";
    try {
      const raw = window.sessionStorage.getItem(key);
      const position = raw === null ? 0 : Number(raw);
      if (Number.isFinite(position) && position >= 0) element.scrollTop = position;
    } catch {
      // Scroll restoration is a convenience; navigation must still work without storage.
    }

    let timer: number | null = null;
    const persist = () => {
      try {
        window.sessionStorage.setItem(key, String(element.scrollTop));
      } catch {
        // Ignore storage restrictions.
      }
      timer = null;
    };
    const onScroll = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(persist, 100);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      if (timer !== null) window.clearTimeout(timer);
      persist();
    };
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    // Device-first: My Projects reads from this device's store. A project
    // created on another device does not appear here before it is
    // published — that is intentional. Legacy localStorage records are
    // folded in transparently on first read.
    let alive = true;
    void listLocalProjects(getAccountKey(session?.user?.email)).then((list) => {
      if (!alive) return;
      setProjects(list as LocalProject[]);
    });
    return () => {
      alive = false;
    };
  }, [session?.user?.email, status]);

  return (
    <main className="fixed inset-0 z-20 overflow-hidden" data-gl-shield="">
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 overflow-y-auto px-20 py-28 s:px-0 s:py-32"
        style={{ opacity: entered ? 1 : 0, transition: "opacity 0.3s" }}
      >
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-wrap items-center justify-center gap-20 s:gap-24">
          {/* Smart Edit create card */}
          <div
            className="relative w-full s:h-[70svh] s:max-h-[78rem] s:w-auto flex-none"
            style={{
              aspectRatio: "1080 / 1550",
              animation: entered ? `my-create-pop 1.25s cubic-bezier(0.16,1,0.3,1) 0.05s both` : undefined,
            }}
          >
            <button
              type="button"
              onClick={() => setRatioPanelOpen(true)}
              className="group relative size-full cursor-pointer overflow-hidden rounded-15 border border-dashed border-[#D9D7D0] bg-[#F4F3EF] text-[#1B1B1B] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] transition-colors duration-300 hover:border-[#8C8880] s:rounded-20"
              aria-label="Create a new Smart Edit project"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 bg-[#F4F3EF] text-center">
                <span className="flex size-46 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:scale-105" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="size-20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="text-16 s:text-18 tracking-[-0.05em]">New Smart Edit</span>
                <span className="max-w-[24rem] px-12 text-11 leading-15 text-[#8C8880]">
                  Start from a blank canvas — add text, stickers and photos, then publish it as a website.
                </span>
              </div>
            </button>

            {ratioPanelOpen && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-15 border border-[#D9D7D0] bg-[#FFFDF8]/96 p-12 text-[#1B1B1B] shadow-[0_24px_70px_rgba(27,27,27,0.16)] backdrop-blur-[10px] s:rounded-20"
                style={{ animation: "ratio-panel-in 0.32s cubic-bezier(0.16,1,0.3,1) both" }}
              >
                <div className="w-full max-w-[30rem]">
                  <p className="text-center text-15 tracking-[-0.04em]">Choose a canvas</p>
                  <div className="mt-12 grid grid-cols-2 gap-9">
                    {(Object.keys(CANVAS_RATIOS) as CanvasRatio[]).map((ratio) => {
                      const preset = CANVAS_RATIOS[ratio];
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => {
                            setRatioPanelOpen(false);
                            onCreateSmartEdit?.(ratio);
                          }}
                          className="flex flex-col items-center gap-8 rounded-14 border border-[#D9D7D0] bg-[#FFFDF8] py-14 text-[#1B1B1B] transition-all duration-200 hover:border-[#8C8880] hover:bg-[#F4F3EF] active:scale-[0.97]"
                        >
                          <span
                            className="block w-56 border-[1.5px] border-[#1B1B1B]/55 bg-[#F0EFEB]"
                            style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
                            aria-hidden="true"
                          />
                          <span className="text-12 tracking-[-0.02em]">{preset.hint}</span>
                          <span className="text-9 text-[#8C8880]">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRatioPanelOpen(false)}
                    className="mt-12 w-full py-8 text-center text-10 text-[#8C8880] transition-colors hover:text-[#1B1B1B]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {projects.length === 0 ? (
            <div
              className="w-full pb-20 text-center text-[#1B1B1B]"
              style={{
                opacity: entered ? 1 : 0,
                transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <p className="text-24 s:text-32 tracking-[-0.06em]">My Projects</p>
              <p className="mt-3 text-14 s:text-16 opacity-55 tracking-[-0.04em]">
                Projects you create or duplicate will appear here.
              </p>
            </div>
          ) : (
            projects.map((project, index) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject?.(project.id, project.templateSlug ?? "")}
                className="group relative w-full s:h-[70svh] s:max-h-[78rem] s:w-auto flex-none cursor-pointer overflow-hidden rounded-15 border border-[#D9D7D0] text-left shadow-[0_18px_45px_rgba(27,27,27,0.10)] s:rounded-20"
                style={{
                  aspectRatio: "1080 / 1550",
                  animation: entered
                    ? `my-project-pop 1.25s cubic-bezier(0.16,1,0.3,1) ${0.1 + index * 0.04}s both`
                    : undefined,
                }}
              >
                <div
                  className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[0.985]"
                  style={{ containerType: "size" }}
                >
                  {project.templateSlug === "smart-edit" && project.data?.document ? (
                    <SmartEditPreview
                      document={project.data.document}
                      assets={Object.values(project.data.assets ?? {}) as AssetRecord[]}
                    />
                  ) : project.thumbnail ? (
                    <img src={project.thumbnail} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-[#E9E8E4]" />
                  )}
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <p className="pointer-events-none absolute bottom-10 inset-x-10 s:bottom-10 s:inset-x-20 flex items-end justify-between text-white">
                  <span className="min-w-0 truncate text-16 s:text-18 tracking-[-0.05em]">{project.title}</span>
                  <span className="relative ml-6 inline-flex size-25 s:size-25 flex-none items-center justify-center rounded-full bg-black text-white transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="size-15" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <style>{`@keyframes my-create-pop { from { opacity: 0; transform: scale(0.94) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } } @keyframes my-project-pop { from { opacity: 0; transform: scale(0.96) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } } @keyframes ratio-panel-in { from { opacity: 0; transform: translateY(28px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </main>
  );
}
