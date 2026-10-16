"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccountKey } from "@/lib/accountStorage";
import { putLocalProject } from "@/lib/localProjects";
import { WebsiteEditor } from "./WebsiteEditor";

/** Backwards-compatible entry point; its edits are local drafts too. */
export function WebsiteTemplateBuilder({ onClose }: { onClose?: () => void } = {}) {
  const { data: session, status } = useSession();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (status === "loading" || started.current) return;
    started.current = true;
    let cancelled = false;
    const id = `website-love-of-my-life-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    void putLocalProject({
      id,
      account: getAccountKey(session?.user?.email),
      title: "Love of My Life",
      templateSlug: "love-of-my-life",
      thumbnail: "/website-templates/love-of-my-life-preview.png",
      createdAt: now,
      updatedAt: now,
      data: { kind: "website-template" },
    }).then((saved) => {
      if (cancelled) return;
      if (saved) setProjectId(id);
      else setStorageError(true);
    }).catch(() => {
      if (!cancelled) setStorageError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, status]);

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }
    window.location.assign("/");
  };

  if (!projectId) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-[#fff] px-24 text-center text-black">
        <p role={storageError ? "alert" : "status"} className="max-w-[28rem] text-14 leading-20">
          {storageError
            ? "This draft couldn't be saved on this device. Check your browser storage and try again."
            : "Preparing your website draft…"}
        </p>
      </main>
    );
  }

  return <WebsiteEditor templateSlug="love-of-my-life" projectId={projectId} onClose={close} />;
}
