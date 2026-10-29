"use client";

import { SITE } from "@/lib/projects";

interface HudProps {
  view: "home" | "my" | "saved" | "project" | "smart-edit" | "website-templates";
  overlay: "profile" | null;
  onProfile: () => void;
  onSaved: () => void;
  onHome: () => void;
  onMy: () => void;
  onWebsiteTemplates: () => void;
}

export function Hud({ view, overlay, onProfile, onSaved, onHome, onMy, onWebsiteTemplates }: HudProps) {
  const savedOpen = view === "saved";
  const homeActive = view === "home" || view === "project";
  const introVisible = view === "home" || view === "website-templates";
  const navClass = (active: boolean) => "ps-nav-item" + (active ? " is-active" : "");
  const title = view === "website-templates" ? "Personal websites, made personal." : "Build Personal Website In Seconds";
  const eyebrow = view === "website-templates" ? "PAPER STISH / WEBSITE TEMPLATES" : "PAPER STISH / MAKE IT PERSONAL";
  const copy = view === "website-templates" ? "Choose a story, then make it yours with your own words and photos." : "Start with a design, make it yours, and share it with someone you love.";

  return (
    <>
      <div className="ps-app-chrome">
        <header className="ps-app-header">
          <a href="/create" onClick={(event) => { event.preventDefault(); onHome(); }} className="ps-app-brand" aria-label="Paper Stish home">
            <span className="ps-app-brand-mark" aria-hidden="true">P</span><span>{SITE.name}</span>
          </a>
          <nav className="ps-primary-nav" aria-label="Paper Stish workspace">
            <button type="button" aria-current={homeActive ? "page" : undefined} onClick={onHome} className={navClass(homeActive)}>Templates</button>
            <button type="button" aria-current={view === "website-templates" ? "page" : undefined} onClick={onWebsiteTemplates} className={navClass(view === "website-templates")}>Websites</button>
            <button type="button" aria-current={view === "my" ? "page" : undefined} onClick={onMy} className={navClass(view === "my")}>My Projects</button>
            <button type="button" aria-current={savedOpen ? "page" : undefined} onClick={savedOpen ? onHome : onSaved} className={navClass(savedOpen)}>Saved</button>
          </nav>
          <button type="button" className="ps-profile-button" aria-expanded={overlay === "profile"} onClick={onProfile}>
            <span className="ps-profile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.7-3.2 3-5 6.5-5s5.8 1.8 6.5 5" strokeLinecap="round"/></svg></span>
            <span>{overlay === "profile" ? "Close" : "Profile"}</span>
          </button>
        </header>
      </div>
      {introVisible && <section className="ps-page-hero" aria-label={view === "website-templates" ? "Website templates" : "Template gallery"}>
        <p className="ps-page-eyebrow">{eyebrow}</p><h1 className="ps-page-title">{title}</h1><p className="ps-page-copy">{copy}</p>
      </section>}
      <nav className="ps-mobile-nav" aria-label="Paper Stish workspace">
        <button type="button" aria-current={homeActive ? "page" : undefined} onClick={onHome} className={navClass(homeActive)}>Templates</button>
        <button type="button" aria-current={view === "website-templates" ? "page" : undefined} onClick={onWebsiteTemplates} className={navClass(view === "website-templates")}>Websites</button>
        <button type="button" aria-current={view === "my" ? "page" : undefined} onClick={onMy} className={navClass(view === "my")}>My</button>
        <button type="button" aria-current={savedOpen ? "page" : undefined} onClick={savedOpen ? onHome : onSaved} className={navClass(savedOpen)}>Saved</button>
      </nav>
    </>
  );
}
