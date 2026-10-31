"use client";

import { useEffect, useRef, useState } from "react";
import type { MemoryLaneProfile, TemplatePublicationValues } from "@/lib/publications";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TEMPLATE_URL = `${BASE_PATH}/website-templates/memory-lane.html`;
const EMPTY_DOCUMENT = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;background:#000;overflow:hidden}</style></head><body></body></html>';

export const MEMORY_LANE_DEFAULT_PROFILES: MemoryLaneProfile[] = [
  { year: "2023", heroTitle: "", photoUrl: null },
  { year: "2025", heroTitle: "", photoUrl: null },
  { year: "2024", heroTitle: "", photoUrl: null },
  { year: "2022", heroTitle: "", photoUrl: null },
];

function normalizeProfiles(value: unknown): MemoryLaneProfile[] {
  if (!Array.isArray(value)) return MEMORY_LANE_DEFAULT_PROFILES.map((profile) => ({ ...profile }));
  return value.slice(0, 6).flatMap((item): MemoryLaneProfile[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const year = typeof raw.year === "string" ? raw.year.slice(0, 4) : "";
    if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) return [];
    const heroTitle = typeof raw.heroTitle === "string" ? raw.heroTitle.slice(0, 80) : "";
    const photoUrl = typeof raw.photoUrl === "string" && raw.photoUrl.length <= 560_000 &&
      (raw.photoUrl === "" || /^(data:image\/|https?:\/\/)/.test(raw.photoUrl))
      ? raw.photoUrl || null
      : null;
    return [{ year, heroTitle, photoUrl }];
  });
}

export function MemoryLaneTemplate({
  values,
  editing = false,
  onProfilesChange,
  onExit,
}: {
  values?: TemplatePublicationValues;
  editing?: boolean;
  onProfilesChange?: (profiles: MemoryLaneProfile[]) => void;
  onExit?: () => void;
}) {
  const [html, setHtml] = useState(EMPTY_DOCUMENT);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const latestProfiles = useRef<MemoryLaneProfile[]>(normalizeProfiles(values?.memoryLaneProfiles));
  const latestEditing = useRef(editing);
  const lastSentProfiles = useRef("");

  latestProfiles.current = normalizeProfiles(values?.memoryLaneProfiles);
  latestEditing.current = editing;

  useEffect(() => {
    let alive = true;
    fetch(TEMPLATE_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the original Memory Lane template.");
        return response.text();
      })
      .then((source) => {
        if (!alive) return;
        setHtml(source);
        setSourceLoaded(true);
        setSourceError("");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[MemoryLaneTemplate] Failed to load the original template HTML.", error);
        if (alive) setSourceError(message);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: unknown; profiles?: unknown };
      if (data.type === "paper-stish:template-ready") {
        iframeReady.current = true;
        const profiles = normalizeProfiles(latestProfiles.current);
        lastSentProfiles.current = JSON.stringify(profiles);
        frame.contentWindow?.postMessage({
          type: "paper-stish:init",
          editing: latestEditing.current,
          profiles,
        }, "*");
        return;
      }

      if (data.type === "paper-stish:profiles-change" && latestEditing.current) {
        const profiles = normalizeProfiles(data.profiles);
        const snapshot = JSON.stringify(profiles);
        if (snapshot === lastSentProfiles.current) return;
        lastSentProfiles.current = snapshot;
        onProfilesChange?.(profiles);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onProfilesChange]);

  useEffect(() => {
    if (!iframeReady.current) return;
    const profiles = normalizeProfiles(values?.memoryLaneProfiles);
    const snapshot = JSON.stringify(profiles);
    if (snapshot === lastSentProfiles.current) return;
    lastSentProfiles.current = snapshot;
    iframeRef.current?.contentWindow?.postMessage({ type: "paper-stish:update-profiles", profiles }, "*");
  }, [values?.memoryLaneProfiles]);

  useEffect(() => {
    if (!iframeReady.current) return;
    iframeRef.current?.contentWindow?.postMessage({ type: "paper-stish:set-editing", editing }, "*");
  }, [editing]);

  return (
    <main
      data-template-preview-source-loaded={sourceLoaded ? "true" : undefined}
      data-template-preview-source-error={sourceError || undefined}
      style={{ position: "fixed", inset: 0, zIndex: 50, overflow: "hidden", background: "#000" }}
    >
      {sourceError ? (
        <div role="alert" style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", padding: 24, color: "#fff", font: "14px/1.6 system-ui", textAlign: "center" }}>
          {sourceError}
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          title="Memory Lane website template"
          srcDoc={html}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      )}
      {editing && onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to website templates"
          style={{
            position: "absolute",
            zIndex: 2,
            top: "max(14px, env(safe-area-inset-top))",
            left: "max(14px, env(safe-area-inset-left))",
            minHeight: 40,
            padding: "0 15px",
            border: "1px solid rgba(255,255,255,.22)",
            borderRadius: 999,
            color: "#fff",
            background: "rgba(0,0,0,.62)",
            font: "600 12px/1 system-ui",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
          }}
        >
          ← Templates
        </button>
      )}
    </main>
  );
}
