import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_FILES: Readonly<Record<string, string>> = {
  "love-heart": "love-heart.html.gz.b64",
  "forever-and-ever": "forever-and-ever.html.gz.b64",
};

/**
 * Return the exact, original template HTML for the sandboxed iframe.
 *
 * The source files are stored as base64-encoded gzip payloads to keep the
 * repository compact. Decode them with Node on the server rather than relying
 * on browser-specific DecompressionStream support in the editor/viewer.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const fileName = TEMPLATE_FILES[slug];

  if (!fileName) {
    return new Response("Template not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const sourcePath = path.join(process.cwd(), "public", "website-templates", fileName);
    const encoded = await readFile(sourcePath, "utf8");
    const html = gunzipSync(Buffer.from(encoded.trim(), "base64")).toString("utf8");

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`[template-source] Failed to decode ${slug}`, error);
    return new Response("Template source could not be loaded", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
