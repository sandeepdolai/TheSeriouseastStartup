"use client";

import { useEffect, useState } from "react";
import { BirthdayTemplate } from "@/components/templates/BirthdayTemplate";
import { LoveLifeTemplate } from "@/components/templates/LoveLifeTemplate";
import { decodePublishedPayload, type PublishedTemplatePayload } from "@/lib/publish";

export function PublishedTemplateViewer() {
  const [payload, setPayload] = useState<PublishedTemplatePayload | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("paper-stish-viewer");

    const read = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const value = hash.startsWith("data=") ? hash.slice(5) : "";
      setPayload(value ? decodePublishedPayload(value) : null);
    };

    read();
    window.addEventListener("hashchange", read);

    return () => {
      window.removeEventListener("hashchange", read);
      document.documentElement.classList.remove("paper-stish-viewer");
    };
  }, []);

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
        heading={payload.data?.heading ?? "Love of my life"}
        years={payload.data?.years ?? "2"}
        yearsLabel={payload.data?.yearsLabel ?? "years with you"}
        sideNote={payload.data?.sideNote ?? "favorite person"}
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
