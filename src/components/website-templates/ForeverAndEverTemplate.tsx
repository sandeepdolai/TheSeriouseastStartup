"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplatePublicationValues } from "@/lib/publications";
import styles from "./ForeverAndEverTemplate.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TEMPLATE_URL = `${BASE_PATH}/website-templates/forever-and-ever.html.gz.b64`;
const EMPTY_DOCUMENT = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;background:#e9edf5;overflow:hidden}</style></head><body></body></html>';
export const FOREVER_AND_EVER_TEXT_DEFAULTS = {
  heading: "I love you forever\nand ever, my baby !",
  letterParagraphs: [
    "From “good morning” to “good night” and random ‘i miss you’ or 'i love you' messages, it’s the small things that makes everything feel better. Every time we talk, it feels like you’re right here with me.",
    "Sometimes we fight and we argue. I know it’s not always easy, but despite all of that, we still choose each other, we communicate, we fix, and try to make things work.",
    "I just want to thank you for being part of my life, for making me happy, and for loving me even though we’re far apart. I can’t wait for the day when distance is just a memory, and I'll finally be with you. We can do all the things we’ve talked about when that happens.",
    "For now, I’ll hold on to every memory and message we’ve shared. Our love story is still being written, and I’m so glad to be part of it :)",
  ],
};

interface Props {
  values?: TemplatePublicationValues;
  editing?: boolean;
  onTextChange?: (field: "heading", value: string) => void;
  onParagraphChange?: (index: number, value: string) => void;
  onPhotoClick?: (index: number) => void;
  onExit?: () => void;
}

export function resolveForeverAndEverText(
  values?: Pick<TemplatePublicationValues, "heading" | "letterParagraphs">,
) {
  const heading =
    typeof values?.heading === "string" && values.heading.trim()
      ? values.heading
      : FOREVER_AND_EVER_TEXT_DEFAULTS.heading;
  const letterParagraphs = FOREVER_AND_EVER_TEXT_DEFAULTS.letterParagraphs.map((fallback, index) => {
    const value = values?.letterParagraphs?.[index];
    return typeof value === "string" && value.trim() ? value : fallback;
  });
  return { heading, letterParagraphs };
}

function textState(values?: TemplatePublicationValues) {
  return JSON.stringify(resolveForeverAndEverText(values));
}

/**
 * Renders the uploaded HTML inside an isolated iframe while preserving its
 * original layout, decorations, heading, and four letter paragraphs. If an
 * old saved draft or publication has blank text fields, the original wording
 * is restored before it reaches the iframe so blank legacy state cannot erase it.
 */
export function ForeverAndEverTemplate({
  values,
  editing = false,
  onTextChange,
  onParagraphChange,
  onPhotoClick,
  onExit,
}: Props) {
  const [html, setHtml] = useState(EMPTY_DOCUMENT);
  const [previewFrameReady, setPreviewFrameReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const latestValues = useRef(values);
  const latestEditing = useRef(editing);
  const lastFrameText = useRef<string | null>(null);

  // These refs must reflect render-time state before any iframe message arrives.
  latestValues.current = values;
  latestEditing.current = editing;

  useEffect(() => {
    let alive = true;
    fetch(TEMPLATE_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the original love-letter template.");
        const encoded = (await response.text()).trim();
        const binary = window.atob(encoded);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Response(stream).text();
      })
      .then((source) => {
        if (alive) setHtml(source);
      })
      .catch(() => {
        if (alive) setHtml(EMPTY_DOCUMENT);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as {
        type?: unknown;
        heading?: unknown;
        letterParagraphs?: unknown;
        index?: unknown;
      };

      if (data.type === "paper-stish:template-ready") {
        iframeReady.current = true;
        setPreviewFrameReady(true);
        const current = latestValues.current;
        const currentText = resolveForeverAndEverText(current);
        lastFrameText.current = textState(current);
        frame.contentWindow?.postMessage({
          type: "paper-stish:init",
          editing: latestEditing.current,
          heading: currentText.heading,
          letterParagraphs: currentText.letterParagraphs,
          images: current?.images ?? [],
        }, "*");
        return;
      }

      if (data.type === "paper-stish:choose-photo" && latestEditing.current &&
          typeof data.index === "number" && data.index >= 0 && data.index < 3) {
        onPhotoClick?.(data.index);
        return;
      }

      if (data.type === "paper-stish:change" && latestEditing.current) {
        const current = latestValues.current;
        const currentText = resolveForeverAndEverText(current);
        const heading = typeof data.heading === "string" ? data.heading.slice(0, 200) : currentText.heading;
        const paragraphs = Array.isArray(data.letterParagraphs)
          ? data.letterParagraphs.slice(0, 4).map((value) => typeof value === "string" ? value.slice(0, 1200) : "")
          : currentText.letterParagraphs;
        const nextSnapshot = JSON.stringify({ heading, letterParagraphs: paragraphs });
        lastFrameText.current = nextSnapshot;

        if (heading !== currentText.heading) onTextChange?.("heading", heading);
        paragraphs.forEach((value, index) => {
          if (value !== currentText.letterParagraphs[index]) onParagraphChange?.(index, value);
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onTextChange, onParagraphChange, onPhotoClick]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!iframeReady.current || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "paper-stish:update-photos", images: values?.images ?? [] }, "*");
  }, [values?.images]);

  useEffect(() => {
    const currentText = resolveForeverAndEverText(values);
    const snapshot = JSON.stringify(currentText);
    if (!iframeReady.current || snapshot === lastFrameText.current) return;
    lastFrameText.current = snapshot;
    iframeRef.current?.contentWindow?.postMessage({
      type: "paper-stish:update-text",
      heading: currentText.heading,
      letterParagraphs: currentText.letterParagraphs,
    }, "*");
  }, [values?.heading, values?.letterParagraphs]);

  useEffect(() => {
    if (!iframeReady.current) return;
    iframeRef.current?.contentWindow?.postMessage({ type: "paper-stish:set-editing", editing }, "*");
  }, [editing]);

  return (
    <main
      className={styles.screen}
      data-template-preview-frame-ready={previewFrameReady ? "true" : undefined}
    >
      <iframe
        ref={iframeRef}
        title="I love you forever and ever, my baby!"
        className={styles.frame}
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => {
          // The first load is the deliberately blank fallback document. Only
          // mark the preview frame ready after the real fetched HTML is applied.
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
