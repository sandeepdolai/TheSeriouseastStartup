"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { putLocalProject } from "@/lib/localProjects";
import { TemplateCarousel } from "./TemplateCarousel";
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

  return (
    <main className="fixed inset-0 z-20 pointer-events-none bg-transparent text-white">
      <TemplateCarousel
        templates={templates.map((template) => ({
          id: template.id,
          title: template.title,
          previewUrl: template.previewUrl ?? null,
          aspect:
            template.document?.canvas?.width && template.document?.canvas?.height
              ? template.document.canvas.width / template.document.canvas.height
              : 1,
        }))}
        onSelect={(id) => {
          const template = templates.find((item) => item.id === id);
          if (template) setSelected(template);
        }}
      />

      {loading && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center text-10 uppercase tracking-[0.08em] text-white/45">
          Loading templates
        </div>
      )}

      {error && (
        <div className="pointer-events-auto fixed left-1/2 top-1/2 z-30 w-[min(34rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 rounded-16 border border-white/10 bg-black/80 px-18 py-15 text-center text-12 text-white backdrop-blur-xl">
          {error}
        </div>
      )}

      {!loading && !error && templates.length === 0 && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center text-12 text-white/45">
          No templates have been published yet.
        </div>
      )}

      {selected && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-15 py-20 backdrop-blur-[8px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section className="flex max-h-[92vh] w-full max-w-[1050px] flex-col overflow-hidden rounded-20 bg-white text-black shadow-2xl s:flex-row">
            <div className="min-h-0 flex-1 bg-[#111] p-15 s:p-25">
              <div className="flex h-full min-h-[55vh] items-center justify-center overflow-hidden rounded-12 bg-[#0d0d0d]">
                {selected.previewUrl ? (
                  <img
                    src={selected.previewUrl}
                    alt={selected.title}
                    draggable={false}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : null}
              </div>
            </div>

            <div className="w-full shrink-0 overflow-y-auto p-20 s:w-[330px] s:p-25">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="float-right flex size-34 items-center justify-center rounded-full bg-black/6 text-18"
                aria-label="Close template"
              >
                ×
              </button>

              <div className="clear-both pt-25 s:pt-50">
                <p className="label opacity-40">TEMPLATE</p>
                <h2 className="mt-8 text-28 leading-none tracking-[-0.05em]">{selected.title}</h2>
                <p className="mt-12 whitespace-pre-line text-12 leading-18 text-black/48">
                  {selected.description?.trim() ||
                    "Duplicate this design to make your own version in Smart Edit. Your changes are completely separate from the original template."}
                </p>

                <div className="mt-25 flex flex-col gap-8">
                  <button
                    type="button"
                    disabled={!!working}
                    onClick={() => void duplicate()}
                    className="h-48 rounded-full bg-black text-13 text-white disabled:opacity-45"
                  >
                    {working === "duplicate" ? "Opening…" : "Duplicate"}
                  </button>
                  <button
                    type="button"
                    disabled={!!working}
                    onClick={saveTemplate}
                    className="h-48 rounded-full border border-black/12 bg-black/[0.03] text-13 text-black disabled:opacity-45"
                  >
                    {working === "save" ? "Saved" : "Save"}
                  </button>
                </div>

                <p className="mt-15 text-10 leading-14 text-black/35">
                  Sign in is required only when you duplicate or save.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
