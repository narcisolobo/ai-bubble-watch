#!/usr/bin/env node
// Smoke driver for AI Bubble Watch: refresh -> build -> check the page ->
// screenshot it at phone and desktop width, light and dark.
// Run from the repo root. Never touches the repo's data/ or dist/.
//
//   node .claude/skills/run-ai-bubble-watch/smoke.mjs [--data DIR] [--out DIR] [--no-shots] [--height PX]
//
//   --data DIR   build from existing data files in DIR; skips the refresh
//   --out DIR    where data/, dist/, and shots/ go (default: $TMPDIR/ai-bubble-watch-smoke)
//   --no-shots   skip the screenshots
//   --height PX  screenshot height (default 5200; headless Chrome can't size to content)
//
// The refresh needs SEC_USER_AGENT (SEC returns 403 without contact info).
// Screenshots need Chrome: $CHROME, else macOS Google Chrome, else
// google-chrome / chromium on PATH.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const out = resolve(opt("--out") ?? join(tmpdir(), "ai-bubble-watch-smoke"));
const height = Number(opt("--height") ?? 5200);
const dataDir = opt("--data") ? resolve(opt("--data")) : join(out, "data");
const distDir = join(out, "dist");
const shotsDir = join(out, "shots");

if (!existsSync("config/indicators.ts")) fail("run this from the repo root");

function fail(message) {
  console.error(`smoke: ${message}`);
  process.exit(1);
}

function run(script, env) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) fail(`${script} exited ${result.status}`);
}

// 1. Refresh into scratch (unless reusing data).
if (opt("--data")) {
  console.log(`== using existing data in ${dataDir}`);
} else {
  if (!process.env.SEC_USER_AGENT) fail('set SEC_USER_AGENT, e.g. SEC_USER_AGENT="AI Bubble Watch you@example.com"');
  console.log(`== refresh -> ${dataDir}`);
  run("src/refresh.ts", { DATA_DIR: dataDir });
}

// 2. Build.
console.log(`== build -> ${distDir}`);
run("src/build.ts", { DATA_DIR: dataDir, DIST_DIR: distDir });
const page = join(distDir, "index.html");
const html = readFileSync(page, "utf8");

// 3. Check the page. Text of an element: tags out, entities in, spaces collapsed.
const text = (s) =>
  s.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const { indicators } = await import(pathToFileURL(resolve("config/indicators.ts")).href);

console.log("== page");
const summary = html.match(/<section id="summary"[\s\S]*?<\/section>/)?.[0];
if (!summary) fail("no summary section");
console.log(`summary: ${text(summary).replace(/^Summary /, "")}`);

let problems = 0;
for (const { id } of indicators) {
  const card = html.match(new RegExp(`<article id="${id}"[^>]*>[\\s\\S]*?</article>`))?.[0];
  if (!card) {
    console.log(`MISSING ${id}`);
    problems++;
    continue;
  }
  const status = card.match(/data-status="([^"]+)"/)[1];
  const value = text(card.match(/<p data-reading>[\s\S]*?<\/p>/)?.[0] ?? "no value");
  const flags = [card.includes("data-stale") && "stale", card.includes("data-fetch-failed") && "fetch-failed"].filter(Boolean);
  console.log(`${status.padEnd(12)} ${id.padEnd(24)} ${value}${flags.length ? `  [${flags.join(", ")}]` : ""}`);
  if (status === "no-data") problems++;
}
const uncovered = html.match(/<section id="uncovered"[\s\S]*?<\/section>/)?.[0];
console.log(`uncovered: ${uncovered ? text(uncovered).replace(/^Scenarios without an indicator yet /, "") : "MISSING"}`);
if (!uncovered || !/informational only/.test(html)) problems++;

// 4. Screenshots. Headless Chrome on macOS won't make a window narrower
// than 500px, so phone width loads the page in a 390px iframe.
if (!args.includes("--no-shots")) {
  const chrome = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ...["google-chrome", "chromium", "chromium-browser"].map((bin) => spawnSync("which", [bin], { encoding: "utf8" }).stdout?.trim()),
  ].find((p) => p && existsSync(p));
  if (!chrome) {
    console.log("== screenshots skipped: no Chrome found (set CHROME=/path/to/chrome)");
  } else {
    console.log("== screenshots");
    mkdirSync(shotsDir, { recursive: true });
    const frame = join(distDir, "phone-frame.html");
    writeFileSync(frame, `<!doctype html><body style="margin:0"><iframe src="index.html" style="width:390px;height:${height}px;border:0"></iframe>\n`);
    const shots = [
      ["phone-light", frame, 500, 1],
      ["phone-dark", frame, 500, 0],
      ["desktop-light", page, 1280, 1],
      ["desktop-dark", page, 1280, 0],
    ];
    for (const [name, file, width, scheme] of shots) {
      const png = join(shotsDir, `${name}.png`);
      const result = spawnSync(
        chrome,
        [
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          `--blink-settings=preferredColorScheme=${scheme}`,
          `--window-size=${width},${height}`,
          "--virtual-time-budget=2000",
          `--screenshot=${png}`,
          pathToFileURL(file).href,
        ],
        { encoding: "utf8" },
      );
      console.log(existsSync(png) && result.status === 0 ? png : `FAILED ${name}: ${result.stderr.slice(-300)}`);
    }
  }
}

if (problems) fail(`${problems} problem(s) above`);
console.log("== ok");
