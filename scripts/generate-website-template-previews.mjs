import { spawn, execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PREVIEWS = [
  { slug: "memory-lane", waitMs: 6200 },
  { slug: "red-letter", waitMs: 1600 },
  { slug: "rose", waitMs: 12000 },
  { slug: "love-heart", waitMs: 30000 },
  { slug: "forever-and-ever", waitMs: 6000 },
  { slug: "introducing-him", waitMs: 2200 },
  { slug: "our-calendar", waitMs: 1400 },
  { slug: "birthday-today", waitMs: 1400 },
  { slug: "love-of-my-life", waitMs: 1400 },
  { slug: "birthday-template", waitMs: 1400 },
  { slug: "photo-album", waitMs: 1400 },
];

const PLAYWRIGHT_VERSION = "1.52.0";
const port = Number(process.env.PAPER_STISH_PREVIEW_PORT || 3187);
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = path.resolve("public/website-templates");
const nextCli = path.resolve("node_modules/next/dist/bin/next");
const isCi = process.env.CI === "true" || process.env.VERCEL === "1";

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

async function fetchTemplateSource(slug, maxAttempts = 5) {
  const url = `${origin}/website-templates/${slug}.html`;
  let lastError = "no response";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.text();
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maxAttempts) {
      const delayMs = attempt * 750;
      console.warn(`Source preflight ${slug} attempt ${attempt} failed (${lastError}); retrying in ${delayMs}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Could not verify original ${slug} HTML after ${maxAttempts} attempts: ${lastError}`);
}

async function waitForServer(server, timeoutMs = 180_000) {
  const started = Date.now();
  let lastError = "not started";
  while (Date.now() - started < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`Next preview server exited early (code ${server.exitCode}). ${lastError}`);
    }
    try {
      const response = await fetch(`${origin}/template-preview/love-heart`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for the template preview server: ${lastError}`);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  // The exact source HTML is decoded before Next starts so the template's
  // iframe fetches the same static document in preview capture and deployment.
  run(process.execPath, [path.resolve("scripts/prepare-template-html.mjs")]);

  // The screenshot is generated from the actual rendered template component.
  // Pin the CLI/browser version to keep the capture environment reproducible.
  if (process.env.PLAYWRIGHT_SKIP_INSTALL !== "1") {
    run("npx", ["--yes", `playwright@${PLAYWRIGHT_VERSION}`, "install", "chromium"]);
  }

  const server = spawn(
    process.execPath,
    [nextCli, "dev", "-p", String(port)],
    {
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(port),
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: isCi ? ["ignore", "pipe", "pipe"] : "inherit",
    },
  );

  let serverOutput = "";
  if (isCi) {
    const append = (chunk) => {
      serverOutput += chunk.toString();
      if (serverOutput.length > 12000) serverOutput = serverOutput.slice(-12000);
    };
    server.stdout?.on("data", append);
    server.stderr?.on("data", append);
  }

  try {
    await waitForServer(server);
    for (const { slug, waitMs } of PREVIEWS) {
      const url = `${origin}/template-preview/${slug}`;
      const outputPath = path.join(outputDirectory, `${slug}-preview.png`);

      // Validate the original HTML for the two embedded website templates
      // before screenshotting. A missing/generated fallback must never silently
      // become a cover image.
      if (slug === "memory-lane" || slug === "red-letter" || slug === "love-heart" || slug === "forever-and-ever" || slug === "introducing-him" || slug === "rose") {
        const sourceHtml = await fetchTemplateSource(slug);
        const expectedMarkup = slug === "memory-lane"
          ? "<title>Who’s watching?</title>"
          : slug === "red-letter"
          ? "<title>A Little Red Letter — Paper Stish</title>"
          : slug === "love-heart"
          ? "<title>Love Heart</title>"
          : slug === "forever-and-ever"
            ? 'aria-label="Love letter notebook page"'
            : slug === "rose"
              ? "<title>Rose — Paper Stish</title>"
              : "<title>Introducing Him — Paper Stish</title>";
        if (!sourceHtml.includes(expectedMarkup)) {
          throw new Error(`Generated ${slug} HTML does not match the original template markup.`);
        }
        console.log(`Verified original ${slug} HTML (${sourceHtml.length} characters).`);
      }

      console.log(`Capturing real ${slug} website render → ${outputPath}`);
      run("npx", [
        "--yes",
        `playwright@${PLAYWRIGHT_VERSION}`,
        "screenshot",
        "--browser=chromium",
        "--viewport-size=900,900",
        "--wait-for-selector=[data-template-preview-ready=true]",
        "--timeout=60000",
        `--wait-for-timeout=${waitMs}`,
        url,
        outputPath,
      ]);
    }
  } catch (error) {
    if (serverOutput) process.stderr.write(serverOutput);
    throw error;
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      if (server.exitCode !== null) return resolve();
      const timeout = setTimeout(() => {
        server.kill("SIGKILL");
        resolve();
      }, 5000);
      server.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error("Could not generate exact website template previews.");
  console.error(error);
  process.exitCode = 1;
});
