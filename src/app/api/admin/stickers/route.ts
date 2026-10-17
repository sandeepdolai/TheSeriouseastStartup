import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import { jsonError, readJsonBody, requireUser } from "@/lib/publicationServer";
import { registerManagedSticker } from "@/lib/cloudinaryStickerLibrary";

const MAX_NAME_LENGTH = 80;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user || !isAdminEmail(user.email)) {
    return jsonError(403, "Only the Paper Stish administrator can add shared stickers.");
  }

  const body = await readJsonBody(req, 8 * 1024);
  if (!body) return jsonError(400, "That sticker could not be read.");

  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  const tier = body.tier;

  if (!publicId || !name) return jsonError(400, "Add a name and upload a sticker first.");
  if (tier !== "free" && tier !== "pro") {
    return jsonError(400, "Choose whether this sticker belongs to Free or Pro.");
  }

  // A valid recent grant proves this administrator was authorized to upload this exact asset
  // into the shared sticker namespace. A browser cannot register an arbitrary Cloudinary image.
  const grant = await db.uploadAuthorization.findFirst({
    where: {
      userId: user.id,
      purpose: "sticker-library",
      publicId,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!grant) {
    return jsonError(403, "That upload is not authorized for the shared sticker library. Upload it again.");
  }

  try {
    const sticker = await registerManagedSticker(publicId, name, tier);
    return Response.json({ sticker }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Sticker library registration failed:", error);
    return jsonError(502, "The sticker was uploaded, but Paper Stish could not save its library details. Try again.");
  }
}
