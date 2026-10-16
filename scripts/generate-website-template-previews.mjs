import { spawn, execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PREVIEWS = [
  { slug: "love-heart", waitMs: 9000 },
  { slug: "forever-and-ever", waitMs: 2200 },
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

  // The screenshot is generated from the actual rendered template component.
  // Pin the CLI/browser version to keep the capture environment reproducible.
  run("npx", ["--yes", `playwright@${PLAYWRIGHT_VERSION}`, "install", "chromium"]);

  const server = spawn(
    process.execPath,
    [nextCli, "dev", "-p", String(port)],
    {
      env: {
        ...process.env,
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
      console.log(`Capturing real ${slug} website render → ${outputPath}`);
      run("npx", [
        "--yes",
        `playwright@${PLAYWRIGHT_VERSION}`,
        "screenshot",
        "--browser=chromium",
        "--viewport-size=900,900",
        "--wait-for-selector=[data-template-preview-ready=true]",
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
