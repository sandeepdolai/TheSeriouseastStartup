import { db } from "@/lib/db";
import {
  jsonError,
  parseProjectBody,
  projectToResponse,
  readJsonBody,
  requireUser,
} from "@/lib/smartEditServer";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/smart-edit/projects/:id — fetch one of the signed-in user's
 * projects. Foreign or missing ids both return 404 so existence is not leaked.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to open your Smart Edit projects.");

  const { id } = await ctx.params;
  const row = await db.smartEditProject.findFirst({
    where: { id, ownerId: user.id },
    include: { publication: true },
  });
  if (!row) return jsonError(404, "Project not found.");

  return Response.json(projectToResponse(row));
}

/**
 * PUT /api/smart-edit/projects/:id — save (title + document + assets).
 * Ownership is enforced server-side; only the owner can update.
 */
export async function PUT(req: Request, ctx: RouteContext) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to save Smart Edit projects.");

  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  if (!body) return jsonError(413, "This project is too large to save. Remove a few images and try again.");

  const parsed = parseProjectBody(body);
  if (!parsed) return jsonError(400, "That project data could not be read.");

  const existing = await db.smartEditProject.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return jsonError(404, "Project not found.");

  const row = await db.smartEditProject.update({
    where: { id },
    data: {
      title: parsed.title,
      document: JSON.stringify(parsed.document),
      assets: JSON.stringify(parsed.assets),
    },
    include: { publication: true },
  });

  return Response.json(projectToResponse(row));
}

/** DELETE /api/smart-edit/projects/:id — remove a project (and its publication). */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to manage your Smart Edit projects.");

  const { id } = await ctx.params;
  const existing = await db.smartEditProject.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return jsonError(404, "Project not found.");

  await db.smartEditProject.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
