"use client";

import { useEffect, useState } from "react";
import {
  BIRTHDAY_DEFAULT_MESSAGE,
  BirthdayTemplate,
} from "./templates/BirthdayTemplate";
import {
  createTemplateId,
  encodePublishedPayload,
  slugPart,
} from "@/lib/publish";

interface TemplateEditorProps {
  projectId: string;
  templateSlug: string;
  onClose: () => void;
}

interface PublishedRecord {
  username: string;
  viewerName: string;
  templateId: string;
  url: string;
  publishedAt: string;
}

interface ProjectRecord {
  id: string;
  title: string;
  templateSlug?: string;
  data?: {
    heading?: string;
    message?: string;
    photoUrl?: string | null;
    published?: PublishedRecord | null;
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<PublishedRecord | null>(null);
  const [copied, setCopied] = useState(false);

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
      setPublished(current.data?.published ?? null);

      const savedUsername = localStorage.getItem("paper-stish-username");
      if (savedUsername) setUsername(savedUsername);
    } catch {
      // Local-first editor remains usable if stored data is malformed.
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
                published,
              },
              updatedAt,
            }
          : item,
      );

      localStorage.setItem("paper-stish-projects", JSON.stringify(next));
      setProject((current) =>
        current
          ? {
              ...current,
              data: {
                ...(current.data ?? {}),
                heading,
                message,
                photoUrl,
                published,
              },
            }
          : current,
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch {
      // Keep the editor responsive when browser storage rejects a write.
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

  const publish = () => {
    const cleanUsername = slugPart(username, "");
    const cleanViewerName = slugPart(viewerName, "");

    if (!cleanUsername || !cleanViewerName || publishing) return;

    try {
      setPublishing(true);
      localStorage.setItem("paper-stish-username", username.trim());

      const templateId = createTemplateId();
      const publishedAt = new Date().toISOString();
      const payload = encodePublishedPayload({
        version: 1,
        templateSlug,
        title: project?.title ?? "Paper Stish",
        heading,
        message,
        photoUrl,
        publishedAt,
      });

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const path =
        basePath +
        "/" +
        cleanUsername +
        "/" +
        cleanViewerName +
        "/" +
        templateId;
      const url =
        window.location.origin +
        path +
        "#data=" +
        payload;

      const record: PublishedRecord = {
        username: cleanUsername,
        viewerName: cleanViewerName,
        templateId,
        url,
        publishedAt,
      };

      setPublished(record);

      const raw = localStorage.getItem("paper-stish-projects");
      const projects = raw ? JSON.parse(raw) : [];
      if (Array.isArray(projects)) {
        const next = projects.map((item) =>
          item?.id === projectId
            ? {
                ...item,
                data: {
                  ...(item.data ?? {}),
                  heading,
                  message,
                  photoUrl,
                  published: record,
                },
                updatedAt: publishedAt,
              }
            : item,
        );
        localStorage.setItem("paper-stish-projects", JSON.stringify(next));
      }
    } catch {
      // Keep the editor usable if the browser rejects a large publish payload.
    } finally {
      window.setTimeout(() => setPublishing(false), 300);
    }
  };

  const copyPublishedLink = async () => {
    if (!published?.url) return;

    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard permissions are browser-controlled.
    }
  };

  const templateReady = templateSlug === "birthday-template";

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
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="whitespace-nowrap rounded-full bg-white px-13 py-10 text-12 tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] s:px-16"
          >
            Publish
          </button>
        </div>
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

      {publishOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-15 backdrop-blur-[10px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPublishOpen(false);
          }}
        >
          <div className="w-full max-w-[470px] rounded-[22px] border border-white/10 bg-[#121212] p-18 shadow-2xl">
            {!published ? (
              <>
                <div className="flex items-start justify-between gap-15">
                  <div>
                    <p className="text-20 tracking-[-0.05em]">Publish website</p>
                    <p className="mt-6 text-11 leading-15 text-white/42">
                      Choose the names used in the personal website link.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishOpen(false)}
                    className="flex size-32 items-center justify-center rounded-full bg-white/7 text-white/65"
                    aria-label="Close publish dialog"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-20 grid gap-13">
                  <label className="grid gap-7">
                    <span className="text-10 text-white/45">Your name</span>
                    <input
                      autoFocus
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="alex"
                      className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-11 text-13 text-white outline-none focus:border-white/25"
                    />
                  </label>

                  <label className="grid gap-7">
                    <span className="text-10 text-white/45">Person this is for</span>
                    <input
                      value={viewerName}
                      onChange={(event) => setViewerName(event.target.value)}
                      placeholder="olivia"
                      className="w-full rounded-[13px] border border-white/10 bg-white/5 px-12 py-11 text-13 text-white outline-none focus:border-white/25"
                    />
                  </label>
                </div>

                <div className="mt-18 rounded-[15px] border border-white/8 bg-white/[0.025] p-12">
                  <p className="text-10 text-white/38">Your link will look like</p>
                  <p className="mt-5 break-all font-mono text-11 leading-16 text-white/75">
                    {typeof window !== "undefined" ? window.location.origin : ""}/
                    {slugPart(username, "your-name")}/
                    {slugPart(viewerName, "their-name")}/
                    1xxxxxxxx
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    publishing ||
                    !slugPart(username, "") ||
                    !slugPart(viewerName, "")
                  }
                  onClick={publish}
                  className="mt-15 w-full rounded-full bg-white py-12 text-12 text-black disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {publishing ? "Publishing…" : "Publish website"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-15">
                  <div>
                    <p className="text-20 tracking-[-0.05em]">Your website is ready</p>
                    <p className="mt-6 text-11 leading-15 text-white/42">
                      This link opens the finished website directly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishOpen(false)}
                    className="flex size-32 items-center justify-center rounded-full bg-white/7 text-white/65"
                    aria-label="Close publish dialog"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-18 rounded-[15px] border border-white/8 bg-white/[0.025] p-12">
                  <p className="break-all font-mono text-11 leading-17 text-white/75">
                    {published.url}
                  </p>
                </div>

                <div className="mt-13 grid grid-cols-2 gap-9">
                  <button
                    type="button"
                    onClick={copyPublishedLink}
                    className="rounded-full bg-white py-11 text-11 text-black"
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={published.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center rounded-full border border-white/12 py-11 text-11 text-white"
                  >
                    Open website
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPublished(null);
                    setViewerName("");
                  }}
                  className="mt-10 w-full py-8 text-10 text-white/35"
                >
                  Publish another link
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
