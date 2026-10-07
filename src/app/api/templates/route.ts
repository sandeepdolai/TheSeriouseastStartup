import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireUser, jsonError, readJsonBody } from "@/lib/publicationServer";
import { isAdminEmail } from "@/lib/admin";
import { validateSmartEditDocument, SMART_EDIT_MAX_DOCUMENT_BYTES } from "@/components/smartedit/publish";

function newTemplateSlug(): string {
  return `template-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function validTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().slice(0, 120);
  return title || null;
}

function safeAssets(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
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
      document: JSON.parse(template.document),
      assets: JSON.parse(template.assets),
      publishedAt: template.publishedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user || !isAdminEmail(user.email)) {
    return jsonError(403, "Only the Paper Stish administrator can publish templates.");
  }

  const body = await readJsonBody(req, SMART_EDIT_MAX_DOCUMENT_BYTES + 2 * 1024 * 1024);
  if (!body) return jsonError(413, "That template is too large to publish.");

  const title = validTitle(body.title);
  if (!title) return jsonError(400, "Give the template a name before publishing.");

  const document = validateSmartEditDocument(body.document);
  if (!document) return jsonError(400, "That Smart Edit document could not be read.");

  const assets = safeAssets(body.assets);
  const documentJson = JSON.stringify(document);
  const assetsJson = JSON.stringify(assets);

  if (
    Buffer.byteLength(documentJson) + Buffer.byteLength(assetsJson) >
    SMART_EDIT_MAX_DOCUMENT_BYTES + 2 * 1024 * 1024
  ) {
    return jsonError(413, "That template is too large to publish.");
  }

  const template = await db.communityTemplate.create({
    data: {
      slug: newTemplateSlug(),
      title,
      document: documentJson,
      assets: assetsJson,
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
