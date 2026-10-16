"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { listLocalProjects, putLocalProject } from "@/lib/localProjects";
import { WebsiteEditor } from "./WebsiteEditor";

/** Backwards-compatible entry point, now using the lightweight image/text editor. */
export function WebsiteTemplateBuilder({ onClose }: { onClose?: () => void } = {}) {
  const { data: session, status } = useSession();
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    let alive = true;
    const prepareDraft = async () => {
      const account = getAccountKey(session?.user?.email);
      try {
        const projects = await listLocalProjects(account);
        let draft = projects.find(
          (project) =>
            project.templateSlug === "love-of-my-life" &&
            project.data?.kind === "website-template",
        );
        if (!draft) {
          const now = new Date().toISOString();
          const id = `website-love-of-my-life-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const saved = await putLocalProject({
            id,
            account,
            title: "Love of My Life",
            templateSlug: "love-of-my-life",
            createdAt: now,
            updatedAt: now,
            data: { kind: "website-template" },
          });
          if (!saved) throw new Error("Could not save the draft on this device.");
          draft = { id, account, title: "Love of My Life", templateSlug: "love-of-my-life", createdAt: now, updatedAt: now, data: { kind: "website-template" } };
        }
        if (alive) setDraftProjectId(draft.id);
      } catch {
        if (alive) setError("Paper Stish could not save this draft on your device. Check your browser storage settings and try again.");
      }
    };
    void prepareDraft();
    return () => {
      alive = false;
    };
  }, [session?.user?.email, status]);

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }
    window.location.assign("/");
  };

  if (error) return <p role="alert" className="fixed inset-x-20 top-70 z-[80] mx-auto max-w-[36rem] rounded-12 border border-white/15 bg-[#151515] px-16 py-12 text-12 leading-17 text-white">{error}</p>;
  if (!draftProjectId) return <main className="fixed inset-0 grid place-items-center bg-black text-12 text-white/60" aria-live="polite">Preparing your local draft…</main>;

  return <WebsiteEditor templateSlug="love-of-my-life" draftProjectId={draftProjectId} onClose={close} />;
}
