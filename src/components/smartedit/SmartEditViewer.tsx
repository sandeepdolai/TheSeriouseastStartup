"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Public viewer. Renders a published Smart Edit document as a finished,
   personal website — read-only, responsive, no editor chrome, no auth.
   User fonts embedded in the payload are registered locally; bundled fonts
   are already provided by the app stylesheet.
─────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { SmartEditPublishedPayload } from "./publish";
import { decodeSmartEditPayload } from "./publish";
import { registerFontFromDataUrl } from "./assets";
import { ensureFontsReady } from "./textLayout";
import { SmartEditCanvas } from "./SmartEditCanvas";

export function SmartEditViewer({ initialPayload }: { initialPayload?: SmartEditPublishedPayload | null }) {
  const [payload, setPayload] = useState<SmartEditPublishedPayload | null>(initialPayload ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("paper-stish-viewer");

    const prepare = async (decoded: SmartEditPublishedPayload | null) => {
      if (decoded) {
        // Register embedded user fonts, then make sure every family used by
        // text layers is loaded before the first paint measures lines.
        await Promise.all(
          decoded.document.fonts
            .filter((font) => font.source === "user" && font.dataUrl)
            .map((font) => registerFontFromDataUrl(font.id, font.family, font.dataUrl!)),
        );
        const families = decoded.document.layers
          .filter((layer) => layer.type === "text")
          .map((layer) => ({ family: layer.fontFamily, weight: layer.fontWeight }));
        await ensureFontsReady(families);
        setPayload(decoded);
      }
      setReady(true);
    };

    if (initialPayload) {
      void prepare(initialPayload);
      return () => {
        document.documentElement.classList.remove("paper-stish-viewer");
      };
    }

    // Standalone use: decode the hash directly.
    const read = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const value = hash.startsWith("data=") ? hash.slice(5) : "";
      void prepare(value ? decodeSmartEditPayload(value) : null);
    };

    read();
    window.addEventListener("hashchange", read);
    return () => {
      window.removeEventListener("hashchange", read);
      document.documentElement.classList.remove("paper-stish-viewer");
    };
  }, [initialPayload]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#101010]">
        <div
          className="size-40 rounded-full border-2 border-white/15"
          style={{ borderTopColor: "rgba(255,255,255,0.6)", animation: "se-viewer-spin 0.9s linear infinite" }}
          aria-label="Loading"
          role="status"
        />
        <style>{`@keyframes se-viewer-spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#101010] px-20 text-center text-white">
        <div>
          <p className="text-28 tracking-[-0.03em]">This website link is incomplete.</p>
          <p className="mt-8 text-13 text-white/45">
            Open the complete Paper Stish link that was generated after publishing.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#101010]">
      <SmartEditCanvas
        document={payload.document}
        style={{
          width: `min(100%, ${(payload.document.canvas.width / payload.document.canvas.height) * 82}svh)`,
          maxWidth: "100%",
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        }}
      />
    </main>
  );
}
