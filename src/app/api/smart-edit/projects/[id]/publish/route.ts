import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { slugPart } from "@/lib/slug";
import { jsonError, parseProjectBody, readJsonBody, requireUser } from "@/lib/smartEditServer";
import { SMART_EDIT_MAX_DOCUMENT_BYTES } from "@/components/smartedit/publish";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Unpredictable, URL-safe public id for a publication. */
function newTemplateId(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * POST /api/smart-edit/projects/:id/publish
 *
 * 1. verifies the authenticated user,
 * 2. verifies ownership of the project,
 * 3. validates the document,
 * 4. updates the saved project,
 * 5. creates or updates the publication (stable templateId across republishes),
 * 6. returns the small public link parts — never the document in the URL.
 */
export async function POST(req: Request, ctx: RouteContext) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to publish Smart Edit websites.");

  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  if (!body) return jsonError(413, "This project is too large to publish. Remove a few images and try again.");

  const parsed = parseProjectBody(body);
  if (!parsed) return jsonError(400, "That project data could not be read.");

  const username = slugPart(typeof body.username === "string" ? body.username : "", "");
  const viewerName = slugPart(typeof body.viewerName === "string" ? body.viewerName : "", "");
  if (!username || !viewerName) return jsonError(400, "Choose both names for the website link.");
  if (Buffer.byteLength(JSON.stringify(parsed.document)) > SMART_EDIT_MAX_DOCUMENT_BYTES) {
    return jsonError(413, "This project is too large to publish. Remove a few images and try again.");
  }

  const project = await db.smartEditProject.findFirst({ where: { id, ownerId: user.id } });
  if (!project) return jsonError(404, "Project not found.");

  const documentJson = JSON.stringify(parsed.document);

  // Keep the saved project at least as new as the published snapshot.
  const updated = await db.smartEditProject.update({
    where: { id },
    data: {
      title: parsed.title,
      document: documentJson,
      assets: JSON.stringify(parsed.assets),
    },
  });

  // One publication per project; republishing refreshes the snapshot and
  // keeps the same templateId so earlier links keep resolving.
  let publication = await db.smartEditPublication.findUnique({ where: { projectId: updated.id } });
  if (!publication) {
    for (let attempt = 0; attempt < 4 && !publication; attempt += 1) {
      try {
        publication = await db.smartEditPublication.create({
          data: {
            projectId: updated.id,
            templateId: newTemplateId(),
            username,
            viewerName,
            title: parsed.title,
            document: documentJson,
          },
        });
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002") continue; // templateId collision — retry with a new id
        throw err;
      }
    }
  } else {
    publication = await db.smartEditPublication.update({
      where: { projectId: updated.id },
      data: {
        username,
        viewerName,
        title: parsed.title,
        document: documentJson,
      },
    });
  }

  if (!publication) return jsonError(500, "Could not generate a unique link. Try again.");

  return Response.json({
    templateId: publication.templateId,
    username: publication.username,
    viewerName: publication.viewerName,
    title: publication.title,
    publishedAt: publication.updatedAt.toISOString(),
  });
}
