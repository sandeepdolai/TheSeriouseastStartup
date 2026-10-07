"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { getLocalProject, putLocalProject } from "@/lib/localProjects";
import {
  BIRTHDAY_DEFAULT_MESSAGE,
  BirthdayTemplate,
} from "./templates/BirthdayTemplate";
import {
  LOVE_DEFAULT_MESSAGE,
  LoveLifeTemplate,
} from "./templates/LoveLifeTemplate";
import { compressedPhotoDataUrl } from "./smartedit/assets";

interface TemplateEditorProps {
  projectId: string;
  templateSlug: string;
  onClose: () => void;
}

interface TemplateProjectData {
  heading?: string;
  years?: string;
  yearsLabel?: string;
  sideNote?: string;
  message?: string;
  photoUrl?: string | null;
}

const BIRTHDAY_HEADING = "★ HAPPY BIRTHDAY !!";

export function TemplateEditor({
  projectId,
  templateSlug,
  onClose,
}: TemplateEditorProps) {
  const [project, setProject] = useState<{ title: string } | null>(null);
  const [heading, setHeading] = useState(BIRTHDAY_HEADING);
  const [years, setYears] = useState("2");
  const [yearsLabel, setYearsLabel] = useState("years with you");
  const [sideNote, setSideNote] = useState("favorite person");
  const [message, setMessage] = useState(BIRTHDAY_DEFAULT_MESSAGE);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { data: session, status } = useSession();

  const loveTemplate = templateSlug === "love-of-my-life";

  useEffect(() => {
    if (status === "loading") return;
    let alive = true;

    void (async () => {
      const record = await getLocalProject(
        getAccountKey(session?.user?.email),
        projectId,
      );
      if (!alive || !record) return;

      const defaults = loveTemplate
        ? {
            heading: "Love of my life",
            years: "2",
            yearsLabel: "yers with you",
            sideNote: "favorite person",
            message: LOVE_DEFAULT_MESSAGE,
          }
        : {
            heading: BIRTHDAY_HEADING,
            years: "2",
            yearsLabel: "years with you",
            sideNote: "favorite person",
            message: BIRTHDAY_DEFAULT_MESSAGE,
          };

      const data = (record.data ?? {}) as TemplateProjectData;
      setProject({ title: record.title });
      setHeading(data.heading ?? defaults.heading);
      setYears(data.years ?? defaults.years);
      setYearsLabel(data.yearsLabel ?? defaults.yearsLabel);
      setSideNote(data.sideNote ?? defaults.sideNote);
      setMessage(data.message ?? defaults.message);
      setPhotoUrl(data.photoUrl ?? null);
    })();

    return () => {
      alive = false;
    };
  }, [projectId, loveTemplate, session?.user?.email, status]);

  const collectValues = () => ({
    heading,
    years,
    yearsLabel,
    sideNote,
    message,
    photoUrl,
  });

  const save = async () => {
    if (status !== "authenticated") {
      await signIn("google");
      return;
    }

    const ok = await putLocalProject({
      id: projectId,
      account: getAccountKey(session?.user?.email),
      templateSlug,
      updatedAt: new Date().toISOString(),
      data: collectValues(),
    });

    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    }
  };

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;

    void (async () => {
      try {
        setPhotoUrl(await compressedPhotoDataUrl(file));
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") setPhotoUrl(reader.result);
        };
        reader.readAsDataURL(file);
      }
    })();
  };

  const templateReady =
    templateSlug === "birthday-template" || loveTemplate;

  return (
    <main className="fixed inset-0 z-50 flex min-h-0 flex-col bg-[#0a0a0a] text-white">
      <header className="relative z-30 grid h-72 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 border-b border-white/8 px-15 s:h-82 s:px-25">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close template editor"
          className="flex size-40 items-center justify-center rounded-full bg-white/8 text-white/85 transition-colors duration-300 hover:bg-white/13"
        >
          <span className="text-22 leading-none">×</span>
        </button>

        <div className="min-w-0 text-center">
          <p className="truncate text-15 tracking-[-0.04em]">Paper Stish</p>
          <p className="mt-2 hidden truncate text-10 text-white/38 s:block">
            {project?.title ?? "Template Editor"}
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-6">
          <button
            type="button"
            onClick={save}
            className="whitespace-nowrap rounded-full border border-white/12 bg-white/5 px-13 py-10 text-12 tracking-[-0.02em] text-white transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] s:px-16"
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-cols-1">
          <section className="min-h-0 overflow-y-auto overscroll-contain bg-[#111] px-10 py-15 s:px-20 s:py-20">
            <div className="mx-auto w-full max-w-[760px]">
              {templateReady ? (
                loveTemplate ? (
                  <LoveLifeTemplate
                    editable
                    years={years}
                    yearsLabel={yearsLabel}
                    message={message}
                    photoUrl={photoUrl}
                    onYearsChange={setYears}
                    onYearsLabelChange={setYearsLabel}
                    onMessageChange={setMessage}
                    onPhotoChange={choosePhoto}
                  />
                ) : (
                  <BirthdayTemplate
                    editable
                    heading={heading}
                    message={message}
                    photoUrl={photoUrl}
                    onHeadingChange={setHeading}
                    onMessageChange={setMessage}
                    onPhotoChange={choosePhoto}
                  />
                )
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
