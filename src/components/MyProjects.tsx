"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountStorageKey } from "@/lib/accountStorage";
import { BirthdayTemplate, BIRTHDAY_DEFAULT_MESSAGE } from "./templates/BirthdayTemplate";
import { LoveLifeTemplate, LOVE_DEFAULT_MESSAGE } from "./templates/LoveLifeTemplate";

interface Props {
  entered: boolean;
  onOpenProject?: (projectId: string, templateSlug: string) => void;
}

export type EditorRatio = "9:16" | "16:9" | "4:5" | "1:1";

interface LocalProject {
  id: string;
  title: string;
  thumbnail?: string;
  updatedAt?: string;
  templateSlug?: string;
  data?: {
    heading?: string;
    years?: string;
    yearsLabel?: string;
    sideNote?: string;
    message?: string;
    photoUrl?: string | null;
  };
}

const STORAGE_KEY = "paper-stish-projects";

export function MyProjects({ entered, onOpenProject }: Props) {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    try {
      const saved = localStorage.getItem(getAccountStorageKey(STORAGE_KEY, session?.user?.email));
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setProjects(parsed);
    } catch {
      // Local project data is optional; keep the empty state usable.
    }
  }, [session?.user?.email, status]);

  return (
    <main className="fixed inset-0 z-20 overflow-hidden" data-gl-shield="">
      <div
        className="absolute inset-0 overflow-y-auto px-20 py-28 s:px-0 s:py-32"
        style={{ opacity: entered ? 1 : 0, transition: "opacity 0.3s" }}
      >
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-wrap items-center justify-center gap-20 s:gap-24">
          {projects.length === 0 ? (
            <div
              className="flex min-h-[55svh] w-full items-center justify-center text-center text-white"
              style={{
                opacity: entered ? 1 : 0,
                transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <div>
                <p className="text-24 s:text-32 tracking-[-0.06em]">My Projects</p>
                <p className="mt-3 text-14 s:text-16 opacity-55 tracking-[-0.04em]">
                  Your duplicated projects will appear here.
                </p>
              </div>
            </div>
          ) : (
            projects.map((project, index) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject?.(project.id, project.templateSlug ?? "")}
                className="group relative w-full s:h-[70svh] s:max-h-[78rem] s:w-auto flex-none cursor-pointer overflow-hidden rounded-15 s:rounded-20 text-left"
                style={{
                  aspectRatio: "1080 / 1550",
                  animation: entered
                    ? `my-project-pop 1.25s cubic-bezier(0.16,1,0.3,1) ${0.1 + index * 0.04}s both`
                    : undefined,
                }}
              >
                <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[0.985]">
                  {project.templateSlug === "birthday-template" ? (
                    <BirthdayTemplate
                      heading={project.data?.heading ?? "★ HAPPY BIRTHDAY !!"}
                      message={project.data?.message ?? BIRTHDAY_DEFAULT_MESSAGE}
                      photoUrl={project.data?.photoUrl ?? null}
                    />
                  ) : project.templateSlug === "love-of-my-life" ? (
                    <LoveLifeTemplate
                      years={project.data?.years ?? "2"}
                      yearsLabel={project.data?.yearsLabel ?? "yers with you"}
                      message={project.data?.message ?? LOVE_DEFAULT_MESSAGE}
                      photoUrl={project.data?.photoUrl ?? null}
                    />
                  ) : project.thumbnail ? (
                    <img src={project.thumbnail} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-black/20" />
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
