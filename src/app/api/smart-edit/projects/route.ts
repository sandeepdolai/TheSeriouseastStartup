import { db } from "@/lib/db";
import {
  jsonError,
  parseProjectBody,
  projectToResponse,
  readJsonBody,
  requireUser,
  isValidClientId,
} from "@/lib/smartEditServer";

/**
 * POST /api/smart-edit/projects — create a Smart Edit project.
 * Authenticated users only; the owner is resolved from the session. The
 * client-proposed id (used by local mirrors + drafts) is adopted when valid.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to create Smart Edit projects.");

  const body = await readJsonBody(req);
  if (!body) return jsonError(413, "This project is too large to save. Remove a few images and try again.");

  const parsed = parseProjectBody(body);
  if (!parsed) return jsonError(400, "That project data could not be read.");

  const id = body.id;
  if (!isValidClientId(id)) return jsonError(400, "Invalid project id.");

  const existing = await db.smartEditProject.findUnique({ where: { id } });
  if (existing) return jsonError(409, "This project already exists.");

  const row = await db.smartEditProject.create({
    data: {
      id,
      ownerId: user.id,
      title: parsed.title,
      document: JSON.stringify(parsed.document),
      assets: JSON.stringify(parsed.assets),
    },
    include: { publication: true },
  });

  return Response.json(projectToResponse(row), { status: 201 });
}

/**
 * GET /api/smart-edit/projects — list the signed-in user's Smart Edit
 * projects (newest first). Only the owner's projects are ever returned.
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to view your Smart Edit projects.");

  const rows = await db.smartEditProject.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { publication: true },
  });

  return Response.json(rows.map(projectToResponse));
}
