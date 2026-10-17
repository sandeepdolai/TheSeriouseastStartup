import { listManagedStickers } from "@/lib/cloudinaryStickerLibrary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stickers = await listManagedStickers();
    return Response.json(
      { stickers },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    // The editor can still use the bundled manifest if Cloudinary is temporarily unavailable.
    return Response.json(
      { stickers: [] },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
