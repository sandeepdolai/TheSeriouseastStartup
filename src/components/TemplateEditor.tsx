"use client";

import { useEffect, useState } from "react";
import {
  BIRTHDAY_DEFAULT_MESSAGE,
  BirthdayTemplate,
} from "./templates/BirthdayTemplate";

interface TemplateEditorProps {
  projectId: string;
  templateSlug: string;
  onClose: () => void;
}

interface ProjectRecord {
  id: string;
  title: string;
  templateSlug?: string;
  data?: {
    heading?: string;
    message?: string;
    photoUrl?: string | null;
  };
}

export function TemplateEditor({
  projectId,
  templateSlug,
  onClose,
}: TemplateEditorProps) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [heading, setHeading] = useState("★ HAPPY BIRTHDAY !!");
  const [message, setMessage] = useState(BIRTHDAY_DEFAULT_MESSAGE);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("paper-stish-projects");
      const projects = raw ? JSON.parse(raw) : [];
      const current = Array.isArray(projects)
        ? projects.find((item) => item?.id === projectId)
        : null;

      if (!current) return;

      setProject(current);
      setHeading(current.data?.heading ?? "★ HAPPY BIRTHDAY !!");
      setMessage(current.data?.message ?? BIRTHDAY_DEFAULT_MESSAGE);
      setPhotoUrl(current.data?.photoUrl ?? null);
    } catch {
      // Local-first prototype: preserve the editor even if stored data is malformed.
    }
  }, [projectId]);

  const save = () => {
    try {
      const raw = localStorage.getItem("paper-stish-projects");
      const projects = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(projects)) return;

      const updatedAt = new Date().toISOString();
      const next = projects.map((item) =>
        item?.id === projectId
          ? {
              ...item,
              data: {
                ...(item.data ?? {}),
                heading,
                message,
                photoUrl,
              },
              updatedAt,
            }
          : item
      );

      localStorage.setItem("paper-stish-projects", JSON.stringify(next));
      setProject((current) =>
        current
          ? {
              ...current,
              data: { heading, message, photoUrl },
            }
          : current
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch {
      // Keep the UI responsive if browser storage rejects the write.
    }
  };

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const templateReady = templateSlug === "birthday-template";

  return (
    <main className="fixed inset-0 z-50 flex min-h-0 flex-col bg-[#0a0a0a] text-white">
      <header className="relative z-30 flex h-72 shrink-0 items-center justify-between border-b border-white/8 px-15 s:h-82 s:px-25">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close template editor"
          className="flex size-40 items-center justify-center rounded-full bg-white/8 text-white/85 transition-colors duration-300 hover:bg-white/13"
        >
          <span className="text-22 leading-none">×</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-15 tracking-[-0.04em]">Paper Stish</p>
          <p className="mt-2 text-10 text-white/38">
            {project?.title ?? "Template Editor"}
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          className="rounded-full bg-white px-18 py-10 text-12 tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-h-0 overflow-y-auto overscroll-contain bg-[#111] px-10 py-15 s:px-20 s:py-20">
            <div className="mx-auto w-full max-w-[760px]">
              {templateReady ? (
                <BirthdayTemplate
                  editable
                  heading={heading}
                  message={message}
                  photoUrl={photoUrl}
                  onHeadingChange={setHeading}
                  onMessageChange={setMessage}
                  onPhotoChange={choosePhoto}
                />
              ) : (
                <div className="flex min-h-[70svh] items-center justify-center rounded-[2rem] border border-white/8 bg-[#151515] text-center">
                  <div>
                    <p className="text-19 tracking-[-0.04em]">Template Editor</p>
                    <p className="mt-8 text-12 text-white/40">
                      This template is not connected to the editor yet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-white/8 bg-[#101010] lg:block">
            <div className="p-18">
              <p className="text-13 tracking-[-0.03em]">Edit website</p>
              <p className="mt-4 text-10 leading-14 text-white/40">
                Edit the website itself. Nothing here turns it into a photo canvas.
              </p>

              <div className="mt-20 border-t border-white/8 pt-18">
                <label className="grid gap-7">
                  <span className="text-10 text-white/45">Heading</span>
                  <input
                    value={heading}
                    onChange={(event) => setHeading(event.target.value)}
                    className="w-full rounded-[12px] border border-white/10 bg-white/5 px-11 py-10 text-12 text-white outline-none transition-colors focus:border-white/25"
                  />
                </label>

                <label className="mt-14 grid gap-7">
                  <span className="text-10 text-white/45">Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={12}
                    className="w-full resize-y rounded-[12px] border border-white/10 bg-white/5 px-11 py-10 text-12 leading-17 text-white outline-none transition-colors focus:border-white/25"
                  />
                </label>

                <div className="mt-14 rounded-[14px] border border-white/8 bg-white/[0.025] p-12">
                  <div className="flex items-center justify-between gap-10">
                    <div>
                      <p className="text-11">Photo #1</p>
                      <p className="mt-3 text-10 text-white/35">
                        Replace the photo in the website.
                      </p>
                    </div>
                    <label className="cursor-pointer rounded-full bg-white px-12 py-8 text-10 text-black transition-transform duration-300 hover:scale-[1.02]">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          choosePhoto(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-18 border-t border-white/8 pt-15">
                  <p className="text-10 leading-15 text-white/35">
                    In the website preview, double-click the handwritten text to edit it directly.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="pointer-events-none border-t border-white/8 bg-[#0c0c0c] px-15 py-10 lg:hidden">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-10">
          <span className="text-10 text-white/35">
            Double-click text to edit
          </span>
          <label className="pointer-events-auto cursor-pointer rounded-full bg-white px-13 py-8 text-10 text-black">
            Photo #1
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                choosePhoto(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </main>
  );
}

