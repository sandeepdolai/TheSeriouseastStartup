"use client";

import { SITE } from "@/lib/projects";

interface HudProps {
  view: "home" | "my" | "project" | "smart-edit";
  overlay: "profile" | null;
  onProfile: () => void;
  onHome: () => void;
  onMy: () => void;
}

export function Hud({ view, overlay, onProfile, onSaved, onHome, onMy }: HudProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between px-40 py-25 s:px-80 s:py-40 text-white">
      <div className="flex items-start justify-between">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          className="label pointer-events-auto cursor-pointer relative"
        >
          {SITE.name}
        </a>
        <button
          type="button"
          aria-expanded={overlay === "profile"}
          onClick={onProfile}
          className="label pointer-events-auto transition-opacity duration-300 ease-out hover:opacity-60"
        >
          {overlay === "profile" ? "Close" : "Profile"}
        </button>
      </div>
      <div className="relative flex justify-start">
        <nav className="label relative pointer-events-auto flex gap-x-5" aria-label="Paper Stish views">
          <a
            href="#"
            aria-current={view === "home" || view === "project" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
            className={`relative transition-opacity duration-500 ease-out ${
              view === "my" ? "opacity-50 hover:opacity-100" : ""
            }`}
          >
            Template
          </a>
          <span aria-hidden="true">/</span>
          <a
            href="#"
            aria-current={view === "my" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onMy();
            }}
            className={`relative transition-opacity duration-500 ease-out ${
              view === "my" ? "" : "opacity-50 hover:opacity-100"
            }`}
          >
            My
          </a>
        </nav>
      </div>
    </div>
  );
}
