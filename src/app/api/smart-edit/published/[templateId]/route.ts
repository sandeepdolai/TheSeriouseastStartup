import { db } from "@/lib/db";
import { jsonError } from "@/lib/smartEditServer";
import { validateSmartEditDocument } from "@/components/smartedit/publish";
import type { SmartEditDocument } from "@/components/smartedit/types";

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

/**
 * GET /api/smart-edit/published/:templateId — PUBLIC.
 *
 * Returns the published snapshot for the public viewer. No authentication,
 * no editor controls, and unpublished projects are never reachable (only
 * publication rows are exposed). The document is re-validated before it is
 * served so a corrupted row can never reach a viewer.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const { templateId } = await ctx.params;
  if (!templateId || templateId.length > 64) return jsonError(404, "Not found.");

  const publication = await db.smartEditPublication.findUnique({
    where: { templateId },
  });
  if (!publication) return jsonError(404, "This website link does not exist anymore.");

  let document: SmartEditDocument | null = null;
  try {
    document = validateSmartEditDocument(JSON.parse(publication.document));
  } catch {
    document = null;
  }
  if (!document) return jsonError(410, "This website could not be loaded.");

  return Response.json(
    {
      version: 1,
      templateSlug: "smart-edit",
      title: publication.title,
      publishedAt: publication.publishedAt.toISOString(),
      document,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
