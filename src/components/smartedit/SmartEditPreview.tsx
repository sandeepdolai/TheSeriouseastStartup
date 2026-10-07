"use client";

/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit
   Read-only document preview used by My Projects cards. Hydrates the
   project's local assets from IndexedDB, then renders with the shared
   canvas renderer at whatever size the card provides.
─────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { AssetRecord, SmartEditDocument } from "./types";
import { hydrateAssets } from "./assets";
import { SmartEditCanvas } from "./SmartEditCanvas";

interface Props {
  document: SmartEditDocument;
  assets?: AssetRecord[];
}

export function SmartEditPreview({ document, assets }: Props) {
  const [hydrated, setHydrated] = useState(!assets || assets.length === 0);

  useEffect(() => {
    if (!assets || assets.length === 0) return;
    let alive = true;
    void hydrateAssets(assets).then(() => {
      if (alive) setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [assets]);

  const ready = hydrated;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0d0d",
        containerType: "size",
      }}
    >
      {ready ? (
        <SmartEditCanvas
          document={document}
          style={{
            width: `min(100cqw, ${(document.canvas.width / document.canvas.height) * 100}cqh)`,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
          }}
        />
      ) : (
        <div
          style={{
            width: "42cqh",
            height: "42cqh",
            borderRadius: "999px",
            border: "2px solid rgba(255,255,255,0.14)",
            borderTopColor: "rgba(255,255,255,0.55)",
            animation: "se-preview-spin 0.9s linear infinite",
          }}
          aria-label="Loading preview"
          role="status"
        />
      )}
      <style>{`@keyframes se-preview-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
