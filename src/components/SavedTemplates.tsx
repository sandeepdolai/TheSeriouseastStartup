"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";

interface SavedRecord {
  id?: string;
  slug?: string;
  title?: string;
  thumbnail?: string;
  templateSlug?: string;
  savedAt?: string;
}

interface PublishedTemplate {
  id: string;
  slug: string;
  title: string;
  previewUrl?: string | null;
  assets?: Record<string, { url?: string }>;
}

interface SavedTemplate {
  id: string;
  slug?: string;
  title: string;
  thumbnail?: string;
  savedAt?: string;
}

interface Props {
  entered: boolean;
}

const LEGACY_STORAGE_KEY = "paper-stish-templates";

export function SavedTemplates({ entered }: Props) {
  const { data: session, status } = useSession();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    let alive = true;

    const load = async () => {
      setLoading(true);
      const storageKey = `paper-stish-saved-templates:${getAccountKey(session?.user?.email)}`;

      let records: SavedRecord[] = [];
      try {
        const currentRaw = localStorage.getItem(storageKey);
        const current = currentRaw ? JSON.parse(currentRaw) : [];
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        const legacy = legacyRaw ? JSON.parse(legacyRaw) : [];
        const merged: SavedRecord[] = [];
        const seen = new Set<string>();

        for (const item of [
          ...(Array.isArray(current) ? current : []),
          ...(Array.isArray(legacy) ? legacy : []),
        ]) {
          if (!item || typeof item !== "object") continue;
          const record = item as SavedRecord;
          const key = record.id || record.slug || record.templateSlug;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(record);
        }
        records = merged;

        // Keep older saved templates visible while adopting the current
        // account-scoped key used by the Save button.
        if (Array.isArray(current) ? merged.length !== current.length : merged.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        }
      } catch {
        records = [];
      }

      let published: PublishedTemplate[] = [];
      try {
        const res = await fetch("/api/templates", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { templates?: PublishedTemplate[] };
          published = Array.isArray(data.templates) ? data.templates : [];
        }
      } catch {
        // Legacy saved records can still be shown from their stored thumbnails.
      }

      const byId = new Map(published.map((item) => [item.id, item]));
      const bySlug = new Map(published.map((item) => [item.slug, item]));
      const resolved = records.map((record): SavedTemplate => {
        const current =
          (record.id ? byId.get(record.id) : undefined) ||
          (record.slug ? bySlug.get(record.slug) : undefined) ||
          (record.templateSlug ? bySlug.get(record.templateSlug) : undefined);
        const assetPreview = current
          ? Object.values(current.assets ?? {}).find(
              (asset) => typeof asset.url === "string" && asset.url,
            )?.url
          : undefined;

        return {
          id: record.id || current?.id || record.slug || record.templateSlug || `saved-${Math.random()}`,
          slug: current?.slug || record.slug || record.templateSlug,
          title: current?.title || record.title || "Saved template",
          thumbnail: current?.previewUrl || record.thumbnail || assetPreview,
          savedAt: record.savedAt,
        };
      });

      if (alive) {
        setTemplates(resolved);
        setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [session?.user?.email, status]);

  return (
    <main className="fixed inset-0 z-20 overflow-hidden" data-gl-shield="">
      <div
        className="absolute inset-0 overflow-y-auto px-20 py-28 s:px-0 s:py-32"
        style={{ opacity: entered ? 1 : 0, transition: "opacity 0.3s" }}
      >
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-wrap items-center justify-center gap-20 s:gap-24">
          {loading ? (
            <div className="flex min-h-[55svh] w-full items-center justify-center text-center text-white/50">
              <p className="label">Loading saved templates</p>
            </div>
          ) : templates.length === 0 ? (
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
