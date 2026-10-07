"use client";

import { useEffect, useState } from "react";
import { BirthdayTemplate } from "@/components/templates/BirthdayTemplate";
import { LoveLifeTemplate } from "@/components/templates/LoveLifeTemplate";
import { decodePublishedPayload, type PublishedTemplatePayload } from "@/lib/publish";
import {
  decodeSmartEditPayload,
  validateSmartEditPayload,
  type SmartEditPublishedPayload,
} from "@/components/smartedit/publish";
import { fetchPublication } from "@/components/smartedit/api";
import { SmartEditViewer } from "@/components/smartedit/SmartEditViewer";

interface Props {
  username: string;
  viewerName: string;
  templateId: string;
}

type Phase = "loading" | "ready" | "missing";

/**
 * Public viewer for /{username}/{viewerName}/{templateId}.
 *
 * • Legacy links carry the document in the #data= fragment — still decoded
 *   client-side so previously published websites keep working.
 * • Smart Edit links are ID-based: the document is fetched from the server
 *   through /api/smart-edit/published/{templateId}.
 */
export function PublishedTemplateViewer({ username, viewerName, templateId }: Props) {
  const [payload, setPayload] = useState<PublishedTemplatePayload | null>(null);
  const [smartEdit, setSmartEdit] = useState<SmartEditPublishedPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    document.documentElement.classList.add("paper-stish-viewer");
    let alive = true;

    const readFragment = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const value = hash.startsWith("data=") ? hash.slice(5) : "";
      if (!value) return false;
      // Smart Edit payloads carry their own document — try that decoder first.
      const smart = decodeSmartEditPayload(value);
      setSmartEdit(smart);
      setPayload(smart ? null : decodePublishedPayload(value));
      setPhase("ready");
      return true;
    };

    if (readFragment()) {
      window.addEventListener("hashchange", readFragment);
      return () => {
        window.removeEventListener("hashchange", readFragment);
        document.documentElement.classList.remove("paper-stish-viewer");
      };
    }

    // No fragment → resolve the publication by templateId on the server.
    if (!templateId) {
      return () => {
        document.documentElement.classList.remove("paper-stish-viewer");
      };
    }

    fetchPublication(templateId)
      .then((raw) => {
        if (!alive) return;
        const validated = validateSmartEditPayload(raw);
        if (validated) {
          setSmartEdit(validated);
          setPhase("ready");
        } else {
          setPhase("missing");
        }
      })
      .catch(() => {
        if (!alive) return;
        setPhase("missing");
      });

    return () => {
      alive = false;
      document.documentElement.classList.remove("paper-stish-viewer");
    };
  }, [templateId, username, viewerName]);

  // The route always provides templateId; when absent there is nothing to load.
  const view: Phase = phase === "loading" && !templateId ? "missing" : phase;

  if (view === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#101010]">
        <div
          className="size-40 rounded-full border-2 border-white/15"
          style={{ borderTopColor: "rgba(255,255,255,0.6)", animation: "ptv-spin 0.9s linear infinite" }}
          role="status"
          aria-label="Loading website"
        />
        <style>{`@keyframes ptv-spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (smartEdit) {
    return <SmartEditViewer initialPayload={smartEdit} />;
  }

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#efede2] px-20 text-center text-[#073b91]">
        <div>
          <p
            className="text-28"
            style={{ fontFamily: '"Gochi Hand", "Patrick Hand", cursive' }}
          >
            This website link is incomplete.
          </p>
          <p className="mt-8 font-sans text-13 text-[#073b91]/55">
            Open the complete Paper Stish link that was generated after publishing.
          </p>
        </div>
      </main>
    );
  }

  if (payload.templateSlug === "birthday-template") {
    return (
      <BirthdayTemplate
        heading={payload.heading}
        message={payload.message}
        photoUrl={payload.photoUrl}
      />
    );
  }


  if (payload.templateSlug === "love-of-my-life") {
    return (
      <LoveLifeTemplate
        years={payload.data?.years ?? "2"}
        yearsLabel={payload.data?.yearsLabel ?? "yers with you"}
        message={payload.data?.message ?? payload.message}
        photoUrl={payload.data?.photoUrl ?? payload.photoUrl}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#efede2] px-20 text-center text-[#073b91]">
      <div>
        <p
          className="text-28"
          style={{ fontFamily: '"Gochi Hand", "Patrick Hand", cursive' }}
        >
          Template unavailable
        </p>
        <p className="mt-8 font-sans text-13 text-[#073b91]/55">
          This published template is not connected to a viewer yet.
        </p>
      </div>
    </main>
  );
}
