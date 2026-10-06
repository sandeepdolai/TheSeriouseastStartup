"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountStorageKey } from "@/lib/accountStorage";

interface Props {
  entered: boolean;
}

interface SavedTemplate {
  id: string;
  title: string;
  thumbnail?: string;
  templateSlug?: string;
  savedAt?: string;
}

const STORAGE_KEY = "paper-stish-templates";

export function SavedTemplates({ entered }: Props) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    try {
      const saved = localStorage.getItem(getAccountStorageKey(STORAGE_KEY, session?.user?.email));
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setTemplates(parsed);
    } catch {
      // Saved template data is optional; keep the empty state usable.
    }
  }, [session?.user?.email, status]);

  return (
    <main className="fixed inset-0 z-20 overflow-hidden" data-gl-shield="">
      <div
        className="absolute inset-0 overflow-y-auto px-20 py-28 s:px-0 s:py-32"
        style={{ opacity: entered ? 1 : 0, transition: "opacity 0.3s" }}
      >
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-wrap items-center justify-center gap-20 s:gap-24">
          {templates.length === 0 ? (
            <div
              className="flex min-h-[55svh] w-full items-center justify-center text-center text-white"
              style={{
                opacity: entered ? 1 : 0,
                transition: "opacity 0.45s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <div>
                <p className="text-24 s:text-32 tracking-[-0.06em]">Saved Templates</p>
                <p className="mt-3 text-14 s:text-16 opacity-55 tracking-[-0.04em]">
                  Your saved templates will appear here.
                </p>
              </div>
            </div>
          ) : (
            templates.map((template, index) => (
              <div
                key={template.id}
                className="group relative w-full s:h-[43.5svh] s:max-h-[55rem] s:w-auto flex-none overflow-hidden rounded-15 s:rounded-20"
                style={{
                  aspectRatio: "2048 / 1172",
                  animation: entered
                    ? `saved-template-pop 1.25s cubic-bezier(0.16,1,0.3,1) ${0.1 + index * 0.04}s both`
                    : undefined,
                }}
              >
                {template.thumbnail ? (
                  <img
                    src={template.thumbnail}
                    alt=""
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[0.985]"
                  />
                ) : (
                  <div className="absolute inset-0 size-full bg-[#eee]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <p className="pointer-events-none absolute bottom-10 inset-x-10 s:bottom-10 s:inset-x-20 flex items-end justify-between text-white">
                  <span className="min-w-0 truncate text-16 s:text-18 tracking-[-0.05em]">
                    {template.title}
                  </span>
                  <span
                    className="relative ml-6 inline-flex size-25 s:size-25 flex-none items-center justify-center rounded-full bg-black text-white"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" className="size-15" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`@keyframes saved-template-pop { from { opacity: 0; transform: scale(0.96) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </main>
  );
}
