import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const templates = ["love-heart", "forever-and-ever"];
const directory = path.resolve("public/website-templates");

async function main() {
  for (const slug of templates) {
    const compressedPath = path.join(directory, `${slug}.html.gz.b64`);
    const outputPath = path.join(directory, `${slug}.html`);
    const encoded = await readFile(compressedPath, "utf8");
    const html = gunzipSync(Buffer.from(encoded.trim(), "base64")).toString("utf8");

    if (!/<html[\\s>]/i.test(html) || !/<body[\\s>]/i.test(html)) {
      throw new Error(`The decoded ${slug} source is not a complete HTML document.`);
    }

    await writeFile(outputPath, html, "utf8");
    console.log(`Prepared original ${slug} template HTML (${Buffer.byteLength(html)} bytes).`);
  }
}

main().catch((error) => {
  console.error("Could not prepare the original website-template HTML sources.");
  console.error(error);
  process.exitCode = 1;
});
