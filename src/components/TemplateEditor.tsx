"use client";

import { useEffect, useState } from "react";
import { BirthdayTemplate } from "./templates/BirthdayTemplate";

interface TemplateEditorProps {
  projectId: string;
  templateSlug: string;
  onClose: () => void;
}

interface ProjectRecord {
  id: string;
  title: string;
  thumbnail?: string;
  templateSlug?: string;
  createdAt?: string;
  data?: {
    recipientName?: string;
    message?: string;
    photoUrl?: string | null;
  };
}

export function TemplateEditor({ projectId, templateSlug, onClose }: TemplateEditorProps) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("paper-stish-projects");
      const projects = raw ? JSON.parse(raw) : [];
      const current = Array.isArray(projects)
        ? projects.find((item) => item?.id === projectId)
        : null;

      if (current) {
        setProject(current);
        setRecipientName(current.data?.recipientName ?? "");
        setMessage(current.data?.message ?? "");
        setPhotoUrl(current.data?.photoUrl ?? null);
      }
    } catch {
      // Keep the editor usable even when local project data is unavailable.
    }
  }, [projectId]);

  const save = () => {
    try {
      const raw = localStorage.getItem("paper-stish-projects");
      const projects = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(projects)) return;

      const next = projects.map((item) => {
        if (item?.id !== projectId) return item;
        return {
          ...item,
          data: {
            ...(item.data ?? {}),
            recipientName,
            message,
            photoUrl,
          },
          updatedAt: new Date().toISOString(),
        };
      });

      localStorage.setItem("paper-stish-projects", JSON.stringify(next));
      setProject((current) =>
        current
          ? {
              ...current,
              data: { recipientName, message, photoUrl },
              updatedAt: new Date().toISOString(),
            }
          : current
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch {
      // Ignore storage failures in this local-first prototype.
    }
  };

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
  };

  const template = templateSlug === "birthday-template";

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <header className="absolute left-0 right-0 top-0 z-30 flex items-start justify-between px-20 pt-18 s:px-30 s:pt-25">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close template editor"
          className="flex size-40 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-300 hover:bg-white/15"
        >
          <span className="text-24 leading-none">×</span>
        </button>

        <div className="absolute left-1/2 top-18 -translate-x-1/2 text-center s:top-25">
          <p className="text-18 tracking-[-0.04em]">Paper Stish</p>
          <p className="mt-3 text-11 text-white/40">
            {project?.title ?? "Template Editor"}
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          className="rounded-full bg-white px-24 py-12 text-13 tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </header>

      <div className="absolute inset-0 overflow-y-auto px-15 pb-28 pt-90 s:px-30 s:pb-35 s:pt-100">
        <div className="mx-auto w-full max-w-[760px]">
          {template ? (
            <BirthdayTemplate
              editable
              recipientName={recipientName}
              message={message || undefined}
              photoUrl={photoUrl}
              onRecipientNameChange={setRecipientName}
              onMessageChange={setMessage}
              onPhotoChange={choosePhoto}
            />
          ) : (
            <div className="flex min-h-[60svh] items-center justify-center rounded-[2rem] border border-white/10 bg-[#121212] text-center">
              <div>
                <p className="text-20 tracking-[-0.04em]">Template Editor</p>
                <p className="mt-8 text-13 text-white/45">
                  This template is not connected to the editor yet.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-15 pb-15 s:px-30 s:pb-20">
        <div className="mx-auto flex max-w-[760px] items-center justify-between rounded-full border border-white/10 bg-[#111]/85 px-18 py-12 backdrop-blur-xl">
          <span className="text-11 text-white/45">Double-click text to edit</span>
          <label className="pointer-events-auto cursor-pointer rounded-full bg-white/8 px-14 py-9 text-11 text-white/75 transition-colors duration-300 hover:bg-white/12">
            Add photo
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
