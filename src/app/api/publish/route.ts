import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { slugPart } from "@/lib/slug";
import { jsonError, readJsonBody, requireUser } from "@/lib/publicationServer";
import {
  PUBLISHABLE_TEMPLATE_SLUGS,
  type PublishableTemplateSlug,
  validateTemplateValues,
  TEMPLATE_VALUES_MAX_BYTES,
} from "@/lib/publications";
import { validateSmartEditDocument, SMART_EDIT_MAX_DOCUMENT_BYTES } from "@/components/smartedit/publish";

/** Unpredictable, URL-safe public id for a publication. */
function newTemplateId(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * POST /api/publish — the single server sync point.
 *
 * 1. requires an authenticated user and resolves the owner from the session,
 * 2. validates the request per template type (Smart Edit document or
 *    normal-template values),
 * 3. creates a publication — or updates the caller's existing publication
 *    when `previousTemplateId` names one they own, keeping that public
 *    link working across republishes,
 * 4. returns the small link parts — never the document in the URL.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to publish Paper Stish websites.");

  // Accept either a Smart Edit document or bounded code-template values.
  const body = await readJsonBody(
    req,
    Math.max(SMART_EDIT_MAX_DOCUMENT_BYTES, TEMPLATE_VALUES_MAX_BYTES) + 128 * 1024,
  );
  if (!body) return jsonError(413, "This website is too large to publish. Remove a few images and try again.");

  const templateSlug = typeof body.templateSlug === "string" ? body.templateSlug : "";
  if (!(PUBLISHABLE_TEMPLATE_SLUGS as readonly string[]).includes(templateSlug)) {
    return jsonError(400, "This template cannot be published yet.");
  }
  const slug = templateSlug as PublishableTemplateSlug;

  const username = slugPart(typeof body.username === "string" ? body.username : "", "");
  const viewerName = slugPart(typeof body.viewerName === "string" ? body.viewerName : "", "");
  if (!username || !viewerName) return jsonError(400, "Choose both names for the website link.");

  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "Paper Stish";

  const previousTemplateId =
    typeof body.previousTemplateId === "string" && body.previousTemplateId.length <= 64
      ? body.previousTemplateId
      : null;

  const rawData = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  if (!rawData) return jsonError(400, "That website data could not be read.");

  /* Validate the snapshot per template type and serialize what will be
     stored server-side. */
  let dataJson: string;
  if (slug === "smart-edit") {
    const document = validateSmartEditDocument(rawData.document);
    if (!document) return jsonError(400, "That Smart Edit project could not be read.");
    if (Buffer.byteLength(JSON.stringify(document)) > SMART_EDIT_MAX_DOCUMENT_BYTES) {
      return jsonError(413, "This project is too large to publish. Remove a few images and try again.");
    }
    dataJson = JSON.stringify({ document });
  } else {
    const values = validateTemplateValues(rawData.values);
    if (!values) return jsonError(400, "That template data could not be read.");
    if (Buffer.byteLength(JSON.stringify(values)) > TEMPLATE_VALUES_MAX_BYTES) {
      return jsonError(413, "This website is too large to publish (the photo may be too big). Use a smaller photo and try again.");
    }
    dataJson = JSON.stringify({ values });
  }

  /* Republish: when the caller already owns the publication named by
     previousTemplateId, refresh it in place so the public link stays
     stable. A foreign or missing id simply produces a fresh publication —
     no existence information is leaked. */
  if (previousTemplateId) {
    const existing = await db.publication.findUnique({ where: { templateId: previousTemplateId } });
    if (existing && existing.ownerId === user.id) {
      const updated = await db.publication.update({
        where: { templateId: previousTemplateId },
        data: { templateSlug: slug, username, viewerName, title, data: dataJson },
      });
      return Response.json({
        templateId: updated.templateId,
        username: updated.username,
        viewerName: updated.viewerName,
        title: updated.title,
        publishedAt: updated.updatedAt.toISOString(),
      });
    }
  }

  const publicationCount = await db.publication.count({ where: { ownerId: user.id } });
  if (publicationCount >= 50) {
    return jsonError(429, "You have reached the limit of 50 published websites. Unpublish one before creating another.");
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const publication = await db.publication.create({
        data: {
          templateId: newTemplateId(),
          templateSlug: slug,
          ownerId: user.id,
          username,
          viewerName,
          title,
          data: dataJson,
        },
      });
      return Response.json(
        {
          templateId: publication.templateId,
          username: publication.username,
          viewerName: publication.viewerName,
          title: publication.title,
          publishedAt: publication.publishedAt.toISOString(),
        },
        { status: 201 },
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") continue; // templateId collision — retry with a new id
      throw err;
    }
  }
  return jsonError(500, "Could not generate a unique link. Try again.");
}

/** DELETE /api/publish — unpublish a website owned by the current account. */
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to manage Paper Stish websites.");

  const body = await readJsonBody(req, 8 * 1024);
  const templateId = typeof body?.templateId === "string" ? body.templateId : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(templateId)) {
    return jsonError(400, "That website link could not be identified.");
  }

  const publication = await db.publication.findUnique({ where: { templateId } });
  if (!publication || publication.ownerId !== user.id) {
    return jsonError(404, "That published website was not found.");
  }

  await db.publication.delete({ where: { templateId } });
  return Response.json({ ok: true });
}
