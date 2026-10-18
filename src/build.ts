// Command-line entry point: `npm run build`. Reads the config and the data
// files, and writes dist/index.html. DATA_DIR and DIST_DIR override the
// default directories, so a local build can use scratch data.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { indicators, scenarios } from "../config/indicators.ts";
import { buildModel, renderPage } from "./render.ts";
import { readData } from "./store.ts";

const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL("../data", import.meta.url));
const distDir = process.env.DIST_DIR ?? fileURLToPath(new URL("../dist", import.meta.url));

const data = new Map(await Promise.all(indicators.map(async (i) => [i.id, await readData(dataDir, i.id)] as const)));
const html = renderPage(buildModel({ scenarios, indicators, data, now: new Date().toISOString() }));

await mkdir(distDir, { recursive: true });
const out = join(distDir, "index.html");
await writeFile(out, html);
console.log(`wrote ${out}`);
