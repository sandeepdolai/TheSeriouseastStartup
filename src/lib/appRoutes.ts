/**
 * Canonical client routes for Paper Stish's app.
 *
 * Draft contents stay in the device-first IndexedDB store; URLs contain only
 * stable view identifiers and project IDs, never the editable content itself.
 */
export type AppView =
  | "home"
  | "my"
  | "saved"
  | "project"
  | "smart-edit"
  | "website-templates";

export interface ResolvedAppRoute {
  view: AppView;
  projectSlug?: string;
  smartEditProjectId?: string;
}

function cleanPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function decodeSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && decoded.length <= 160 ? decoded : null;
  } catch {
    return null;
  }
}

/** Resolve app-owned URLs only. Marketing, published, account and API paths are
 * intentionally left to their own Next.js routes. */
export function resolveAppRoute(pathname: string): ResolvedAppRoute | null {
  const path = cleanPath(pathname);

  if (path === "/create") return { view: "website-templates" };
  if (path === "/create/my") return { view: "my" };
  if (path === "/create/saved") return { view: "saved" };
  if (path === "/create/website-templates" || path === "/website-templates") {
    return { view: "website-templates" };
  }

  const featured = path.match(/^\/create\/project\/([^/]+)$/);
  if (featured) {
    const projectSlug = decodeSegment(featured[1]);
    return projectSlug ? { view: "project", projectSlug } : null;
  }

  const smartEdit = path.match(/^\/smart-edit\/([^/]+)$/);
  if (smartEdit) {
    const smartEditProjectId = decodeSegment(smartEdit[1]);
    return smartEditProjectId ? { view: "smart-edit", smartEditProjectId } : null;
  }

  // Direct template previews and /edit deep links render through the website
  // template browser; it reads the template slug and optional draft query.
  if (/^\/website-templates\/[^/]+(?:\/edit)?$/.test(path)) {
    return { view: "website-templates" };
  }

  return null;
}

export function navigateToAppPath(path: string, replace = false): void {
  if (typeof window === "undefined" || !path.startsWith("/") || path.startsWith("//")) return;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (current === path) return;

  if (replace) {
    window.history.replaceState(window.history.state, "", path);
  } else {
    window.history.pushState(window.history.state, "", path);
  }
}

export function safeAppReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/" || value.startsWith("/smart-edit/") || value.includes("/edit?")) return null;
  if (value.startsWith("/api/") || value.startsWith("/auth/")) return null;
  return value;
}
