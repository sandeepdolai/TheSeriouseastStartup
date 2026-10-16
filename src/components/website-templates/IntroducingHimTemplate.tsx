"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplatePublicationValues } from "@/lib/publications";
import styles from "./IntroducingHimTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TEMPLATE_URL = BASE_PATH + "/website-templates/introducing-him.html";
const EMPTY_DOCUMENT = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;background:#fff;overflow:hidden}</style></head><body></body></html>';

export const INTRODUCING_HIM_DEFAULTS = {
  heading: "Introducing him<<<3",
  message: [
    "Who is he??", "My boyfriend.", "My bestfriend.", "My man.", "My soul.",
    "My heart.", "My peace.", "My safeplace.", "My home.", "My future.",
    "My everything.", "My forever.", "My reason.", "My happiness.",
    "My comfort.", "My laughter.", "My light in the dark.",
    "My strength when I'm weak.", "My dream come true.",
    "My favorite human.", "My destiny.", "My only one.", "My forever love. ♡",
  ].join("\n"),
};

type EditableField = "heading" | "message";
interface Props {
  values?: TemplatePublicationValues;
  editing?: boolean;
  onTextChange?: (field: EditableField, value: string) => void;
  onPhotoClick?: () => void;
  onExit?: () => void;
}

function resolveText(values?: TemplatePublicationValues) {
  return {
    heading: typeof values?.heading === "string" && values.heading.trim()
      ? values.heading.slice(0, 200)
      : INTRODUCING_HIM_DEFAULTS.heading,
    message: typeof values?.message === "string" && values.message.trim()
      ? values.message.slice(0, 4000)
      : INTRODUCING_HIM_DEFAULTS.message,
  };
}

function resolvePhoto(values?: TemplatePublicationValues): string {
  if (typeof values?.photoUrl === "string") return values.photoUrl;
  if (values?.photoUrl === null) return "";
  return typeof values?.images?.[0] === "string" ? values.images[0] : "";
}

export function IntroducingHimTemplate({
  values, editing = false, onTextChange, onPhotoClick, onExit,
}: Props) {
  const [html, setHtml] = useState(EMPTY_DOCUMENT);
  const [frameReady, setFrameReady] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const latestValues = useRef(values);
  const latestEditing = useRef(editing);
  const lastFrameText = useRef<string | null>(null);
  latestValues.current = values;
  latestEditing.current = editing;

  useEffect(() => {
    let alive = true;
    fetch(TEMPLATE_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the Introducing Him template.");
        return response.text();
      })
      .then((source) => {
        if (alive) { setHtml(source); setSourceError(null); }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[IntroducingHimTemplate] Source failed to load.", error);
        if (alive) { setSourceError(message); setHtml(EMPTY_DOCUMENT); }
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: unknown; heading?: unknown; message?: unknown; index?: unknown };
      if (data.type === "paper-stish:template-ready") {
        iframeReady.current = true;
        setFrameReady(true);
        const text = resolveText(latestValues.current);
        const photoUrl = resolvePhoto(latestValues.current);
        lastFrameText.current = JSON.stringify(text);
        frame.contentWindow?.postMessage({
          type: "paper-stish:init", editing: latestEditing.current,
          heading: text.heading, message: text.message, photoUrl, images: [photoUrl],
        }, "*");
        return;
      }
      if (data.type === "paper-stish:choose-photo" && latestEditing.current && data.index === 0) {
        onPhotoClick?.();
        return;
      }
      if (data.type === "paper-stish:change" && latestEditing.current) {
        const current = resolveText(latestValues.current);
        const heading = typeof data.heading === "string" ? data.heading.slice(0, 200) : current.heading;
        const message = typeof data.message === "string" ? data.message.slice(0, 4000) : current.message;
        lastFrameText.current = JSON.stringify({ heading, message });
        if (heading !== current.heading) onTextChange?.("heading", heading);
        if (message !== current.message) onTextChange?.("message", message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onTextChange, onPhotoClick]);

  useEffect(() => {
    if (!iframeReady.current || !iframeRef.current?.contentWindow) return;
    const text = resolveText(values);
    const snapshot = JSON.stringify(text);
    if (snapshot === lastFrameText.current) return;
    lastFrameText.current = snapshot;
    iframeRef.current.contentWindow.postMessage({ type: "paper-stish:update-text", ...text }, "*");
  }, [values?.heading, values?.message]);

  useEffect(() => {
    if (!iframeReady.current) return;
    const photoUrl = resolvePhoto(values);
    iframeRef.current?.contentWindow?.postMessage({ type: "paper-stish:update-photos", images: [photoUrl] }, "*");
  }, [values?.photoUrl, values?.images]);

  useEffect(() => {
    if (iframeReady.current) {
      iframeRef.current?.contentWindow?.postMessage({ type: "paper-stish:set-editing", editing }, "*");
    }
  }, [editing]);

  return (
    <main className={styles.screen} data-template-frame-ready={frameReady ? "true" : undefined} data-template-source-error={sourceError ?? undefined}>
      <iframe ref={iframeRef} title="Introducing Him website template" className={styles.frame} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" />
      {editing && onExit && (
        <button type="button" className={styles.backButton} onClick={onExit} aria-label="Back to website templates">
          <span aria-hidden="true">←</span><span>Templates</span>
        </button>
      )}
    </main>
  );
}
