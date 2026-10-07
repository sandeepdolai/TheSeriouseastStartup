/* ───────────────────────────────────────────────────────────────────────────
   Paper Stish — Smart Edit server helpers.
   Session → owner resolution, request body validation and response shaping
   shared by the Smart Edit API routes. Ownership always comes from the
   NextAuth session — client-provided owner data is never trusted.
─────────────────────────────────────────────────────────────────────────── */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateSmartEditDocument } from "@/components/smartedit/publish";
import type { AssetRecord, AssetProvider, AssetType, SmartEditDocument } from "@/components/smartedit/types";
import { SMART_EDIT_MAX_DOCUMENT_BYTES } from "@/components/smartedit/publish";

/** Resolve the signed-in user, creating the account row on first use. */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  if (!session || !userEmail) return null;
  const email = userEmail.trim().toLowerCase();
  if (!email || email.length > 200) return null;
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: typeof session.user.name === "string" ? session.user.name.slice(0, 120) : null },
  });
  return user;
}

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Read + size-limit + parse a JSON request body. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > SMART_EDIT_MAX_DOCUMENT_BYTES + 64 * 1024) {
    return null;
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (text.length > SMART_EDIT_MAX_DOCUMENT_BYTES + 64 * 1024) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ASSET_TYPES = new Set(["image", "sticker", "font"]);
const ASSET_PROVIDERS = new Set(["bundled", "local", "cloudinary"]);

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}

/** Validate an untrusted asset-record map (id → AssetRecord). */
export function safeAssets(raw: unknown): Record<string, AssetRecord> | null {
  if (raw === undefined || raw === null) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 400) return null;
  const out: Record<string, AssetRecord> = {};
  for (const [key, value] of entries) {
    if (key.length > 64) return null;
    if (!value || typeof value !== "object") return null;
    const r = value as Record<string, unknown>;
    const id = boundedString(r.id, 64);
    const type = boundedString(r.type, 16);
    const provider = boundedString(r.provider, 16);
    const name = boundedString(r.name, 80);
    if (!id || id !== key || !type || !ASSET_TYPES.has(type) || !provider || !ASSET_PROVIDERS.has(provider)) {
      return null;
    }
    const width = typeof r.width === "number" && Number.isFinite(r.width) ? r.width : 0;
    const height = typeof r.height === "number" && Number.isFinite(r.height) ? r.height : 0;
    if (width < 0 || height < 0 || width > 100000 || height > 100000) return null;
    out[id] = {
      id,
      type: type as AssetType,
      provider: provider as AssetProvider,
      url: boundedString(r.url, 2000),
      storeKey: boundedString(r.storeKey, 64),
      name: name ?? "asset",
      width,
      height,
      family: boundedString(r.family, 80),
      format: boundedString(r.format, 24),
    };
  }
  return out;
}

export interface SmartEditProjectRow {
  id: string;
  title: string;
  document: string;
  assets: string;
  createdAt: Date;
  updatedAt: Date;
  publication: {
    templateId: string;
    username: string;
    viewerName: string;
    title: string;
    document: string;
    publishedAt: Date;
    updatedAt: Date;
  } | null;
}

/** Shape stored documents into the response the client expects. */
export function projectToResponse(row: SmartEditProjectRow) {
  let document: SmartEditDocument | null = null;
  let assets: Record<string, AssetRecord> = {};
  try {
    document = validateSmartEditDocument(JSON.parse(row.document));
    assets = safeAssets(JSON.parse(row.assets)) ?? {};
  } catch {
    document = null;
  }
  return {
    id: row.id,
    title: row.title,
    templateSlug: "smart-edit" as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    data: {
      kind: "smart-edit" as const,
      document: document ?? { version: 1, canvas: { width: 1080, height: 1350 }, background: { type: "color", color: "#f4efe6" }, layers: [], fonts: [] },
      assets,
      published: row.publication
        ? {
            username: row.publication.username,
            viewerName: row.publication.viewerName,
            templateId: row.publication.templateId,
            publishedAt: row.publication.publishedAt.toISOString(),
          }
        : null,
    },
  };
}

/** Parse + validate a save/publish body's document + assets. */
export function parseProjectBody(
  body: Record<string, unknown>,
): { title: string; document: SmartEditDocument; assets: Record<string, AssetRecord> } | null {
  const rawTitle = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const document = validateSmartEditDocument(body.document);
  if (!document) return null;
  const assets = safeAssets(body.assets);
  if (!assets) return null;
  return { title: rawTitle || "Smart Edit", document, assets };
}

/** Project ids the client may propose at creation time. */
export function isValidClientId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{5,79}$/.test(id);
}
