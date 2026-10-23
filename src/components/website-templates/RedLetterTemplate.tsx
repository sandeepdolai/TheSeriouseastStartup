"use client";

import { useEffect, useRef, useState } from "react";
import type { TemplatePublicationValues } from "@/lib/publications";
import styles from "./RedLetterTemplate.module.css";

const TEMPLATE_URL = (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/website-templates/red-letter.html";
const EMPTY_DOCUMENT =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;background:#fff7f5;overflow:hidden}</style></head><body></body></html>';
const FRAME_SOURCE = "paper-stish-red-letter";
const PARENT_SOURCE = "paper-stish-red-letter-parent";
const DEFAULTS = {
  heading: "A little letter for you",
  message: "I wanted to leave you a little reminder that you mean more to me than I always know how to say.",
  signature: "With love,",
} as const;

type RedLetterField = "heading" | "message" | "signature";

interface Props {
  /** Show the template navigation control while creating a local draft. */
  editing?: boolean;
  values?: TemplatePublicationValues;
  onTextChange?: (field: RedLetterField, value: string) => void;
  onExit?: () => void;
}

/**
 * The envelope artwork, paper, paper text, and animation live in one browser
 * document. The iframe is sandboxed and only exchanges the three editable text
 * values with Paper Stish through a small postMessage bridge.
 */
export function RedLetterTemplate({
  editing = false,
  values,
  onTextChange,
  onExit,
}: Props) {
  const [html, setHtml] = useState<string>(EMPTY_DOCUMENT);
  const [previewFrameReady, setPreviewFrameReady] = useState(false);
  const [templateSourceLoaded, setTemplateSourceLoaded] = useState(false);
  const [templateSourceError, setTemplateSourceError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const latestValues = useRef(values);

  useEffect(() => {
    latestValues.current = values;
  }, [values]);

  useEffect(() => {
    let alive = true;

    fetch(TEMPLATE_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load A Little Red Letter.");
        return response.text();
      })
      .then((source) => {
        const bridgeScript = [
          "<script>",
          "(() => {",
          "  const editing = " + (editing ? "true" : "false") + ";",
          "  const frameSource = " + JSON.stringify(FRAME_SOURCE) + ";",
          "  const parentSource = " + JSON.stringify(PARENT_SOURCE) + ";",
          "  const fields = {",
          "    heading: document.getElementById('letterHeading'),",
          "    message: document.getElementById('letterMessage'),",
          "    signature: document.getElementById('letterSignature')",
          "  };",
          "  const limits = { heading: 200, message: 4000, signature: 160 };",
          "  if (!fields.heading || !fields.message || !fields.signature) return;",
          "  function setField(field, value) {",
          "    const node = fields[field];",
          "    if (!node) return;",
          "    const next = typeof value === 'string' ? value : '';",
          "    if (document.activeElement !== node && node.textContent !== next) node.textContent = next;",
          "    node.contentEditable = editing ? 'true' : 'false';",
          "    node.setAttribute('aria-readonly', editing ? 'false' : 'true');",
          "  }",
          "  function emitChange(field) {",
          "    const node = fields[field];",
          "    const raw = (node.innerText || node.textContent || '').replace(/\\r/g, '');",
          "    const value = raw.slice(0, limits[field]);",
          "    if (value !== raw) node.textContent = value;",
          "    window.parent.postMessage({ source: frameSource, type: 'field-change', field, value }, '*');",
          "  }",
          "  if (editing) {",
          "    Object.keys(fields).forEach((field) => fields[field].addEventListener('input', () => emitChange(field)));",
          "  }",
          "  window.addEventListener('message', (event) => {",
          "    if (event.source !== window.parent || !event.data || event.data.source !== parentSource || event.data.type !== 'set-state') return;",
          "    const state = event.data.values && typeof event.data.values === 'object' ? event.data.values : {};",
          "    setField('heading', typeof state.heading === 'string' ? state.heading : " + JSON.stringify(DEFAULTS.heading) + ");",
          "    setField('message', typeof state.message === 'string' ? state.message : " + JSON.stringify(DEFAULTS.message) + ");",
          "    setField('signature', typeof state.signature === 'string' ? state.signature : " + JSON.stringify(DEFAULTS.signature) + ");",
          "  });",
          "  window.parent.postMessage({ source: frameSource, type: 'ready' }, '*');",
          "})();",
          "</script>",
        ].join("\n");
        const bodyClose = source.toLowerCase().lastIndexOf("</body>");
        const bridged = bodyClose >= 0
          ? source.slice(0, bodyClose) + bridgeScript + source.slice(bodyClose)
          : source + bridgeScript;

        if (alive) {
          setHtml(bridged);
          setTemplateSourceError(null);
          setTemplateSourceLoaded(true);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[RedLetterTemplate] Failed to load the original template HTML.", error);
        if (alive) {
          setTemplateSourceError(message);
          setHtml(EMPTY_DOCUMENT);
        }
      });

    return () => {
      alive = false;
    };
  }, [editing]);

  useEffect(() => {
    const frame = iframeRef.current;

    const onMessage = (event: MessageEvent<unknown>) => {
      if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as { source?: unknown; type?: unknown; field?: unknown; value?: unknown };
      if (data.source !== FRAME_SOURCE) return;

      if (data.type === "ready") {
        iframeReady.current = true;
        setPreviewFrameReady(true);
        const current = latestValues.current;
        frame.contentWindow?.postMessage(
          {
            source: PARENT_SOURCE,
            type: "set-state",
            values: {
              heading: current?.heading ?? DEFAULTS.heading,
              message: current?.message ?? DEFAULTS.message,
              signature: current?.signature ?? DEFAULTS.signature,
            },
          },
          "*",
        );
        return;
      }

      if (
        data.type === "field-change" &&
        editing &&
        (data.field === "heading" || data.field === "message" || data.field === "signature") &&
        typeof data.value === "string"
      ) {
        const max = data.field === "heading" ? 200 : data.field === "message" ? 4000 : 160;
        onTextChange?.(data.field, data.value.slice(0, max));
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editing, onTextChange]);

  useEffect(() => {
    if (!iframeReady.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: PARENT_SOURCE,
        type: "set-state",
        values: {
          heading: values?.heading ?? DEFAULTS.heading,
          message: values?.message ?? DEFAULTS.message,
          signature: values?.signature ?? DEFAULTS.signature,
        },
      },
      "*",
    );
  }, [editing, html, values?.heading, values?.message, values?.signature]);

  return (
    <main
      className={styles.screen}
      data-template-preview-frame-ready={previewFrameReady ? "true" : undefined}
      data-template-preview-source-loaded={templateSourceLoaded ? "true" : undefined}
      data-template-preview-source-error={templateSourceError ?? undefined}
    >
      <iframe
        ref={iframeRef}
        title="A Little Red Letter — personal website"
        className={styles.frame}
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => {
          if (html !== EMPTY_DOCUMENT) setPreviewFrameReady(true);
        }}
      />
      {editing && onExit && (
        <button
          type="button"
          className={styles.backButton}
          onClick={onExit}
          aria-label="Back to website templates"
        >
          <span aria-hidden="true">←</span>
          <span>Templates</span>
        </button>
      )}
    </main>
  );
}
