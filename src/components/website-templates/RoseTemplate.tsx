"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplatePublicationValues } from "@/lib/publications";
import styles from "./RoseTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TEMPLATE_URL = `${BASE_PATH}/website-templates/rose.html`;
const EMPTY_DOCUMENT =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;background:#1c0303;overflow:hidden}</style></head><body></body></html>';
const DEFAULT_HEADING = "We’re sorry, sir — your order will arrive soon.";
const DEFAULT_MESSAGE = "";
export type RoseTemplateVariant = "classic" | "blush" | "noir";
const FRAME_SOURCE = "paper-stish-rose";
const PARENT_SOURCE = "paper-stish-rose-parent";

function getSharedRoseModelUrl(): string | undefined {
  return "https://res.cloudinary.com/cmtfrr9s/image/upload/v1793144811/rose_2.glb";
}

interface Props {
  values?: TemplatePublicationValues;
  editing?: boolean;
  variant?: RoseTemplateVariant;
  onTextChange?: (field: "heading" | "message", value: string) => void;
  onExit?: () => void;
}

/** Keeps the original interactive 3D rose inside an isolated, script-only iframe. */
export function RoseTemplate({ values, editing = false, variant = "classic", onTextChange, onExit }: Props) {
  const [html, setHtml] = useState(EMPTY_DOCUMENT);
  const [previewFrameReady, setPreviewFrameReady] = useState(false);
  const [templateSourceLoaded, setTemplateSourceLoaded] = useState(false);
  const [templateSourceError, setTemplateSourceError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const latestValues = useRef(values);
  const latestEditing = useRef(editing);
  const latestVariant = useRef(variant);

  latestValues.current = values;
  latestEditing.current = editing;
  latestVariant.current = variant;

  useEffect(() => {
    let alive = true;
    fetch(TEMPLATE_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the Rose website template.");
        return response.text();
      })
      .then((source) => {
        if (alive) {
          setHtml(source);
          setTemplateSourceError(null);
          setTemplateSourceLoaded(true);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[RoseTemplate] Failed to load Rose template HTML.", error);
        if (alive) {
          setTemplateSourceError(message);
          setHtml(EMPTY_DOCUMENT);
        }
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as {
        source?: unknown;
        type?: unknown;
        heading?: unknown;
        message?: unknown;
      };
      if (data.source !== FRAME_SOURCE) return;

      if (data.type === "ready") {
        iframeReady.current = true;
        setPreviewFrameReady(true);
        const current = latestValues.current;
        frame.contentWindow?.postMessage({
          source: PARENT_SOURCE,
          type: "set-state",
          editing: latestEditing.current,
          heading: current?.heading ?? DEFAULT_HEADING,
          message: current?.message ?? DEFAULT_MESSAGE,
          variant: latestVariant.current,
          modelUrl: getSharedRoseModelUrl(),
        }, "*");
        return;
      }

      if (data.type === "change" && latestEditing.current) {
        if (typeof data.heading === "string") onTextChange?.("heading", data.heading.slice(0, 120));
        if (typeof data.message === "string") onTextChange?.("message", data.message.slice(0, 400));
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onTextChange]);

  useEffect(() => {
    if (!iframeReady.current) return;
    const current = values;
    iframeRef.current?.contentWindow?.postMessage({
      source: PARENT_SOURCE,
      type: "set-state",
      editing,
      heading: current?.heading ?? DEFAULT_HEADING,
      message: current?.message ?? DEFAULT_MESSAGE,
      variant,
      modelUrl: getSharedRoseModelUrl(),
    }, "*");
  }, [editing, html, variant, values?.heading, values?.message]);

  return (
    <main
      className={styles.screen}
      data-template-preview-frame-ready={previewFrameReady ? "true" : undefined}
      data-template-preview-source-loaded={templateSourceLoaded ? "true" : undefined}
      data-template-preview-source-error={templateSourceError ?? undefined}
    >
      <iframe
        ref={iframeRef}
        title="Rose — interactive 3D rose website"
        className={styles.frame}
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => {
          if (html !== EMPTY_DOCUMENT) setPreviewFrameReady(true);
        }}
      />
      {editing && onExit && (
        <button type="button" className={styles.backButton} onClick={onExit} aria-label="Back to website templates">
          <span aria-hidden="true">←</span>
          <span>Templates</span>
        </button>
      )}
    </main>
  );
}
