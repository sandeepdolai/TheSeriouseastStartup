/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — publications (the server sync point).

   Publishing is the ONLY moment a local project reaches the Paper Stish
   server: the editor sends the current snapshot to POST /api/publish, the
   server validates it, stores it as a Publication row and returns the
   small link parts —

     /{username}/{viewerName}/{templateId}

   The public viewer resolves that templateId server-side; the payload is
   never placed in the URL. Republishing sends `previousTemplateId` so the
   server can keep the existing public link working.

   This module is client + server safe (no "use client", no browser APIs
   at module scope) so the same validation runs in the publish API, the
   viewer page and the browser.
─────────────────────────────────────────────────────────────────────────── */

import type { SmartEditDocument } from "@/components/smartedit/types";
import { validateSmartEditDocument } from "@/components/smartedit/publish";
import { slugPart } from "@/lib/slug";
import { durableTemplateValues } from "@/lib/cloudinaryUpload";
import { isBundledPublicImagePath } from "@/lib/templateImageValue";
import { isValidCalendarHeartDate, type CalendarHeartDate } from "@/lib/calendarHeartValue";

export { slugPart };

/** Template types that can be published. */
export const PUBLISHABLE_TEMPLATE_SLUGS = [
  "smart-edit",
  "memory-lane",
  "birthday-template",
  "birthday-today",
  "love-of-my-life",
  "photo-album",
  "love-heart",
  "forever-and-ever",
  "our-calendar",
  "introducing-him",
  "red-letter",
  "rose",
  "rose-blush",
  "rose-noir",
] as const;

export type PublishableTemplateSlug = (typeof PUBLISHABLE_TEMPLATE_SLUGS)[number];

/** Maximum serialized size of a normal template's values (photos included). */
export const TEMPLATE_VALUES_MAX_BYTES = 4_000_000;

/* ── Types ──────────────────────────────────────────────────────────────── */

/** A year/profile entry inside the Memory Lane template. */
export interface MemoryLaneProfile {
  year: string;
  heroTitle: string;
  /** One device-local image used for the profile tile and its detail backdrop. */
  photoUrl: string | null;
}

/** Freeform placement of an independent photo/video pin on the Setflix canvas. */
export interface MemoryLaneCanvasLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  fit: "cover" | "contain";
}

/** Media used by the Setflix Memory Lane canvas. Local drafts keep a Blob on-device. */
export type MemoryLaneMediaItem =
  | { id: string; type: "image" | "video"; name: string; layout?: MemoryLaneCanvasLayout; url: string; file?: never }
  | { id: string; type: "image" | "video"; name: string; layout?: MemoryLaneCanvasLayout; file: Blob; url?: never };

/** Editable values of a normal template (Birthday, Love of My Life). */
export interface TemplatePublicationValues {
  heading?: string;
  /** Editable greeting text inside the animated Love Heart template. */
  loveMessage?: string;
  /** Editable name inside the birthday-today template. */
  birthdayName?: string;
  /** Extra editable copy used by the fixed personal website themes. */
  intro?: string;
  noteHeading?: string;
  signature?: string;
  years?: string;
  yearsLabel?: string;
  sideNote?: string;
  message?: string;
  /** Editable copy shown on the Memory Lane title/detail screen. */
  memoryLaneTagline?: string;
  memoryLaneDescription?: string;
  memoryLaneStarring?: string;
  memoryLaneGenres?: string;
  photoUrl?: string | null;
  /** Photo Album supports up to six optimized, user-uploaded images. */
  images?: string[];
  /** Optional captions, aligned with the album image array. */
  captions?: string[];
  /** Four editable paragraphs used by the notebook-style love-letter template. */
  letterParagraphs?: string[];
  /** Profiles (year, hero title and optional image) inside Memory Lane. */
  memoryLaneProfiles?: MemoryLaneProfile[];
  /** Photos/videos that play in the Memory Lane viewer. Files remain device-local until publishing. */
  memoryLaneMedia?: MemoryLaneMediaItem[];
  /** Four editable scrapbook notes used by the Our Calendar template. */
  calendarNotes?: string[];
  /** The date marked by the movable heart on Our Calendar. */
  calendarHeart?: CalendarHeartDate;
}

/** What the public viewer receives for a published website. */
export interface PublishedWebsitePayload {
  version: 1;
  templateSlug: PublishableTemplateSlug;
  title: string;
  publishedAt: string;
  /** Smart Edit publications carry the full document. */
  document?: SmartEditDocument;
  /** Normal template publications carry their editable values. */
  values?: TemplatePublicationValues;
}

/** Result of POST /api/publish. */
export interface PublishResult {
  templateId: string;
  username: string;
  viewerName: string;
  title: string;
  publishedAt: string;
}

/** Publication info stored inside a local project record. */
export interface PublishedRecord {
  username: string;
  viewerName: string;
  templateId: string;
  url: string;
  publishedAt: string;
}

export interface PublishWebsiteBody {
  templateSlug: string;
  title: string;
  username: string;
  viewerName: string;
  /** Keeps the previous public link working when republishing. */
  previousTemplateId?: string;
  data: { document?: unknown; values?: unknown };
}

/* ── Validation ─────────────────────────────────────────────────────────── */

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}

const PHOTO_URL_RE =
  /^(data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s"'<>]+)$/;
const MEMORY_LANE_MEDIA_URL_RE =
  /^(data:(?:image|video)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/;

/** Validate untrusted normal-template values (same rules everywhere). */
export function validateTemplateValues(raw: unknown): TemplatePublicationValues | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const photoUrl =
    v.photoUrl === null || v.photoUrl === undefined || v.photoUrl === ""
      ? null
      : boundedString(v.photoUrl, 8_000_000);
  if (photoUrl !== null && (!photoUrl || !PHOTO_URL_RE.test(photoUrl))) return null;
  let images: string[] | undefined;
  if (v.images !== undefined) {
    if (!Array.isArray(v.images) || v.images.length > 6) return null;
    images = [];
    for (const item of v.images) {
      if (
        typeof item !== "string" ||
        item.length > 560_000 ||
        (item !== "" && !PHOTO_URL_RE.test(item) && !isBundledPublicImagePath(item))
      ) return null;
      images.push(item);
    }
  }

  let captions: string[] | undefined;
  if (v.captions !== undefined) {
    if (!Array.isArray(v.captions) || v.captions.length > 6) return null;
    captions = [];
    for (const item of v.captions) {
      if (typeof item !== "string" || item.length > 120) return null;
      captions.push(item);
    }
  }

  let letterParagraphs: string[] | undefined;
  if (v.letterParagraphs !== undefined) {
    if (!Array.isArray(v.letterParagraphs) || v.letterParagraphs.length > 4) return null;
    letterParagraphs = [];
    for (const item of v.letterParagraphs) {
      if (typeof item !== "string" || item.length > 1200) return null;
      letterParagraphs.push(item);
    }
  }

  let memoryLaneProfiles: MemoryLaneProfile[] | undefined;
  if (v.memoryLaneProfiles !== undefined) {
    if (!Array.isArray(v.memoryLaneProfiles) || v.memoryLaneProfiles.length > 6) return null;
    memoryLaneProfiles = [];
    for (const item of v.memoryLaneProfiles) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const profile = item as Record<string, unknown>;
      const year = boundedString(profile.year, 4);
      const heroTitle = boundedString(profile.heroTitle, 80);
      const photoUrl =
        profile.photoUrl === null || profile.photoUrl === undefined || profile.photoUrl === ""
          ? null
          : boundedString(profile.photoUrl, 560_000);
      if (!year || !/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) return null;
      if (heroTitle === undefined) return null;
      if (photoUrl !== null && (!photoUrl || !PHOTO_URL_RE.test(photoUrl))) return null;
      memoryLaneProfiles.push({ year, heroTitle, photoUrl });
    }
  }

  let memoryLaneMedia: MemoryLaneMediaItem[] | undefined;
  if (v.memoryLaneMedia !== undefined) {
    if (!Array.isArray(v.memoryLaneMedia) || v.memoryLaneMedia.length > 12) return null;
    memoryLaneMedia = [];
    for (const item of v.memoryLaneMedia) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const media = item as Record<string, unknown>;
      const id = boundedString(media.id, 80);
      const type = media.type;
      const name = boundedString(media.name, 120);
      const url = boundedString(media.url, 2048);
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
      if (type !== "image" && type !== "video") return null;
      if (name === undefined || !url || !MEMORY_LANE_MEDIA_URL_RE.test(url)) return null;
      let layout: MemoryLaneCanvasLayout | undefined;
      if (media.layout !== undefined) {
        if (!media.layout || typeof media.layout !== "object" || Array.isArray(media.layout)) return null;
        const rawLayout = media.layout as Record<string, unknown>;
        const { x, y, width, height, rotation, z, fit } = rawLayout;
        if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 100 ||
            typeof y !== "number" || !Number.isFinite(y) || y < 0 || y > 100 ||
            typeof width !== "number" || !Number.isFinite(width) || width < 10 || width > 100 ||
            typeof height !== "number" || !Number.isFinite(height) || height < 10 || height > 100 ||
            x + width > 100.01 || y + height > 100.01 ||
            typeof rotation !== "number" || !Number.isFinite(rotation) || rotation < -30 || rotation > 30 ||
            typeof z !== "number" || !Number.isFinite(z) || z < 0 || z > 100 ||
            (fit !== "cover" && fit !== "contain")) return null;
        layout = { x, y, width, height, rotation, z, fit };
      }
      memoryLaneMedia.push({ id, type, name, url, ...(layout ? { layout } : {}) });
    }
  }

  let calendarNotes: string[] | undefined;
  if (v.calendarNotes !== undefined) {
    if (!Array.isArray(v.calendarNotes) || v.calendarNotes.length > 4) return null;
    calendarNotes = [];
    for (const item of v.calendarNotes) {
      if (typeof item !== "string" || item.length > 300) return null;
      calendarNotes.push(item);
    }
  }

  let calendarHeart: CalendarHeartDate | undefined;
  if (v.calendarHeart !== undefined) {
    if (!isValidCalendarHeartDate(v.calendarHeart)) return null;
    calendarHeart = { ...v.calendarHeart };
  }

  const values: TemplatePublicationValues = {
    heading: boundedString(v.heading, 200),
    loveMessage: boundedString(v.loveMessage, 100),
    birthdayName: boundedString(v.birthdayName, 40),
    intro: boundedString(v.intro, 400),
    noteHeading: boundedString(v.noteHeading, 240),
    signature: boundedString(v.signature, 160),
    years: boundedString(v.years, 40),
    yearsLabel: boundedString(v.yearsLabel, 80),
    sideNote: boundedString(v.sideNote, 80),
    message: boundedString(v.message, 4000),
    memoryLaneTagline: boundedString(v.memoryLaneTagline, 120),
    memoryLaneDescription: boundedString(v.memoryLaneDescription, 800),
    memoryLaneStarring: boundedString(v.memoryLaneStarring, 60),
    memoryLaneGenres: boundedString(v.memoryLaneGenres, 100),
    photoUrl,
    images,
    captions,
    letterParagraphs,
    memoryLaneProfiles,
    memoryLaneMedia,
    calendarNotes,
    calendarHeart,
  };
  return values;
}

/** Validate an untrusted published-website payload (viewer + server). */
export function validatePublishedPayload(raw: unknown): PublishedWebsitePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1) return null;
  const templateSlug = boundedString(p.templateSlug, 60);
  if (!templateSlug || !(PUBLISHABLE_TEMPLATE_SLUGS as readonly string[]).includes(templateSlug)) {
    return null;
  }

  const base = {
    version: 1 as const,
    templateSlug: templateSlug as PublishableTemplateSlug,
    title: boundedString(p.title, 120) ?? "Paper Stish",
    publishedAt: boundedString(p.publishedAt, 40) ?? new Date().toISOString(),
  };

  if (templateSlug === "smart-edit") {
    const document = validateSmartEditDocument(p.document);
    if (!document) return null;
    return { ...base, document };
  }

  const values = validateTemplateValues(p.values);
  if (!values) return null;
  return { ...base, values };
}

/** Row shape handed to publicationRowToPayload by the server. */
export interface PublicationRow {
  templateSlug: string;
  title: string;
  data: string;
  publishedAt: Date | string;
}

/** Turn a stored Publication row into the public viewer payload,
 *  re-validating the snapshot so a corrupted row can never reach a viewer. */
export function publicationRowToPayload(row: PublicationRow): PublishedWebsitePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const container = parsed as Record<string, unknown>;
  return validatePublishedPayload({
    version: 1,
    templateSlug: row.templateSlug,
    title: row.title,
    publishedAt:
      row.publishedAt instanceof Date
        ? row.publishedAt.toISOString()
        : String(row.publishedAt),
    document: container.document,
    values: container.values,
  });
}

/* ── Client helpers ─────────────────────────────────────────────────────── */

/**
 * Public website URL — /{username}/{viewerName}/{templateId}.
 * The published website is resolved server-side from the templateId;
 * nothing is ever appended to the URL.
 */
export function buildPublicUrl(username: string, viewerName: string, templateId: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = `${basePath}/${username}/${viewerName}/${templateId}`;
  return window.location.origin + path;
}

/** Build the PublishedRecord stored in the local project from a publish result. */
export function publishResultToRecord(result: PublishResult): PublishedRecord {
  return {
    username: result.username,
    viewerName: result.viewerName,
    templateId: result.templateId,
    url: buildPublicUrl(result.username, result.viewerName, result.templateId),
    publishedAt: result.publishedAt,
  };
}

/** POST /api/publish — store a publication snapshot server-side. */
export async function publishWebsite(body: PublishWebsiteBody): Promise<PublishResult> {
  // Publish-time media boundary: normal-template photos move from the
  // device (base64) to Cloudinary before the snapshot reaches the server,
  // so PostgreSQL never stores embedded image bytes in a Cloudinary-enabled
  // deployment. Inert when Cloudinary is not configured (local development).
  const rawValues = body.data?.values;
  const data: PublishWebsiteBody["data"] =
    rawValues && typeof rawValues === "object" && !Array.isArray(rawValues)
      ? {
          ...body.data,
          values: await durableTemplateValues(rawValues as TemplatePublicationValues),
        }
      : body.data;

  let res: Response;
  try {
    res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, data }),
    });
  } catch {
    throw new Error("Could not reach the Paper Stish server. Check your connection and try again.");
  }
  if (res.ok) {
    return (await res.json()) as PublishResult;
  }
  let message = "";
  try {
    const errorBody = (await res.json()) as { error?: string };
    message = typeof errorBody.error === "string" ? errorBody.error : "";
  } catch {
    // non-JSON error body
  }
  if (res.status === 401) {
    throw new Error("Please sign in to publish Paper Stish websites.");
  }
  throw new Error(message || `Publishing failed (${res.status}).`);
}
