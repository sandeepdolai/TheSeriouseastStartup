import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireUser, jsonError, readJsonBody } from "@/lib/publicationServer";
import { isAdminEmail } from "@/lib/admin";
import { validateSmartEditDocument, SMART_EDIT_MAX_DOCUMENT_BYTES } from "@/components/smartedit/publish";

/** Total headroom above the document budget: assets + stored preview. */
const DESCRIPTION_MAX_CHARS = 500;
const PREVIEW_MAX_BYTES = 4 * 1024 * 1024;
const EXTRA_MAX_BYTES = 2 * 1024 * 1024 + PREVIEW_MAX_BYTES;
const PREVIEW_URL_RE =
  /^(https?:\/\/[^\s"'<>]+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/;
const PREVIEW_PUBLIC_ID_RE = /^[\w\-./@ ]{1,300}$/;
const ASSET_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;

function newTemplateSlug(): string {
  return `template-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function validTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().slice(0, 120);
  return title || null;
}

/** Template description: plain text, line breaks preserved, trimmed, ≤500. */
function validDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").trim().slice(0, DESCRIPTION_MAX_CHARS);
}

/** Stored preview reference: a remote image url or a self-contained data
 *  url. Absent → null (legacy templates render their document live). */
function validPreviewUrl(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  const url = value.trim();
  if (!url) return null;
  if (url.length > PREVIEW_MAX_BYTES || !PREVIEW_URL_RE.test(url)) return "invalid";
  return url;
}

function validPreviewPublicId(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  const id = value.trim();
  if (!id) return null;
  return PREVIEW_PUBLIC_ID_RE.test(id) ? id : "invalid";
}

/** Asset registry snapshot: id → record. Each entry must look like an
 *  AssetRecord (id-safe key, string type/provider, url only as a string). */
function safeAssets(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!ASSET_KEY_RE.test(key)) return null;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const record = entry as Record<string, unknown>;
    if (typeof record.type !== "string" || record.type.length > 16) return null;
    if (typeof record.provider !== "string" || record.provider.length > 16) return null;
    if (record.url !== undefined && typeof record.url !== "string") return null;
    if (record.publicId !== undefined && typeof record.publicId !== "string") return null;
    out[key] = entry;
  }
  return out;
}

export async function GET() {
  const templates = await db.communityTemplate.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });

  return Response.json({
    templates: templates.map((template) => ({
      id: template.id,
      slug: template.slug,
      title: template.title,
      description: template.description ?? "",
      document: JSON.parse(template.document),
      assets: JSON.parse(template.assets),
      previewUrl: template.previewUrl ?? null,
      publishedAt: template.publishedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user || !isAdminEmail(user.email)) {
    return jsonError(403, "Only the Paper Stish administrator can publish templates.");
  }

  const body = await readJsonBody(req, SMART_EDIT_MAX_DOCUMENT_BYTES + EXTRA_MAX_BYTES);
  if (!body) return jsonError(413, "That template is too large to publish.");

  const title = validTitle(body.title);
  if (!title) return jsonError(400, "Give the template a name before publishing.");

  const description = validDescription(body.description);

  const document = validateSmartEditDocument(body.document);
  if (!document) return jsonError(400, "That Smart Edit document could not be read.");

  const assets = safeAssets(body.assets);
  if (!assets) return jsonError(400, "That template's assets could not be read.");

  const previewUrl = validPreviewUrl(body.previewUrl);
  if (previewUrl === "invalid") return jsonError(400, "That template preview could not be read.");

  const previewPublicId = validPreviewPublicId(body.previewPublicId);
  if (previewPublicId === "invalid") {
    return jsonError(400, "That template preview reference could not be read.");
  }

  const documentJson = JSON.stringify(document);
  const assetsJson = JSON.stringify(assets);
  const previewBytes = previewUrl ? Buffer.byteLength(previewUrl) : 0;

  if (
    Buffer.byteLength(documentJson) + Buffer.byteLength(assetsJson) + previewBytes >
    SMART_EDIT_MAX_DOCUMENT_BYTES + EXTRA_MAX_BYTES
  ) {
    return jsonError(413, "That template is too large to publish.");
  }

  const template = await db.communityTemplate.create({
    data: {
      slug: newTemplateSlug(),
      title,
      description,
      document: documentJson,
      assets: assetsJson,
      previewUrl,
      previewPublicId,
      published: true,
      publishedBy: user.id,
    },
  });

  return Response.json(
    {
      id: template.id,
      slug: template.slug,
      title: template.title,
      publishedAt: template.publishedAt.toISOString(),
    },
    { status: 201 },
  );
}
