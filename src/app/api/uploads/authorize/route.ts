import { db } from "@/lib/db";
import { jsonError, readJsonBody, requireUser } from "@/lib/publicationServer";
import { hasProOrAdminAccess } from "@/lib/planAccess";
import { isAdminEmail } from "@/lib/admin";
import {
  ADMIN_ONLY_PURPOSE,
  SIGNED_UPLOAD_PURPOSES,
  buildGrant,
  quotaDecision,
  signedUploadServerConfig,
  UPLOAD_AUTHORIZATION_TTL_MS,
  type SignedUploadPurpose,
} from "@/lib/uploadAuthorization";

/**
 * POST /api/uploads/authorize — the gate in front of every publish-time
 * Cloudinary upload.
 *
 * 1. requires an authenticated user (the upload destination is derived from
 *    the session — client input never chooses it),
 * 2. restricts the community-template namespace to the administrator,
 * 3. enforces per-user rolling upload quotas (abuse prevention), and
 * 4. returns short-lived Cloudinary parameters signed with the server-only
 *    API secret, scoped to a user/site-specific folder.
 *
 * The upload itself goes browser → Cloudinary with those parameters; the
 * API secret never reaches the client. Publish-time policy
 * (publishedMediaPolicy) then only accepts media under the caller's own
 * namespace, so an authorization can never be used to publish someone
 * else's assets.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Sign in to upload photos for publishing.");

  const config = signedUploadServerConfig();
  if (!config) {
    return jsonError(
      503,
      "Cloud storage is not configured on the server. Publishing photos needs the server Cloudinary keys (CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME).",
    );
  }

  const body = await readJsonBody(req, 8 * 1024);
  if (!body) return jsonError(400, "That upload request could not be read.");

  const purpose = body.purpose;
  if (typeof purpose !== "string" || !(SIGNED_UPLOAD_PURPOSES as readonly string[]).includes(purpose)) {
    return jsonError(400, "Unknown upload purpose.");
  }

  if (purpose === ADMIN_ONLY_PURPOSE && !isAdminEmail(user.email)) {
    return jsonError(403, "Only the Paper Stish administrator can publish template assets.");
  }
  if (purpose !== ADMIN_ONLY_PURPOSE && !hasProOrAdminAccess(user, isAdminEmail(user.email))) {
    return Response.json(
      { error: "Uploading photos to publish a website requires Pro. Your local draft is unchanged.", upgradeUrl: "/upgrade" },
      { status: 402 },
    );
  }

  let projectId: string | undefined;
  if (body.projectId !== undefined && body.projectId !== null) {
    if (typeof body.projectId !== "string" || body.projectId.length > 80) {
      return jsonError(400, "That upload request could not be read.");
    }
    projectId = body.projectId;
  }

  const requested =
    typeof body.count === "number" && Number.isFinite(body.count) && body.count >= 1
      ? Math.min(Math.floor(body.count), 24)
      : 1;

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [lastHour, lastDay] = await Promise.all([
    db.uploadAuthorization.count({ where: { userId: user.id, issuedAt: { gte: hourAgo } } }),
    db.uploadAuthorization.count({ where: { userId: user.id, issuedAt: { gte: dayAgo } } }),
  ]);

  const decision = quotaDecision({ lastHour, lastDay }, requested);
  if (!decision.allowed) {
    return Response.json(
      {
        error:
          "Too many photo uploads requested. Wait a while before publishing again.",
      },
      {
        status: 429,
        headers: {
          ...(decision.retryAfterSeconds
            ? { "Retry-After": String(decision.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }

  // Opportunistic cleanup: drop grants expired for more than a day. They are
  // no longer quota-relevant and keep the audit trail bounded.
  await db.uploadAuthorization.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - UPLOAD_AUTHORIZATION_TTL_MS - 24 * 60 * 60 * 1000) } },
  });

  const grants: ReturnType<typeof buildGrant>[] = [];
  for (let i = 0; i < requested; i += 1) {
    const grant = buildGrant(config, user.id, purpose as SignedUploadPurpose, projectId);
    await db.uploadAuthorization.create({
      data: {
        userId: user.id,
        purpose,
        publicId: grant.publicId,
        folder: grant.folder,
        expiresAt: new Date(grant.expiresAt),
      },
    });
    grants.push(grant);
  }

  return Response.json({ uploads: grants }, { status: 200 });
}
