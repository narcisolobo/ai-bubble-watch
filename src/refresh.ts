// Command-line entry point: `npm run refresh`, locally or in the scheduled
// workflow. Exits 0 when individual fetchers fail, so the workflow still
// builds and deploys a page that shows the failures. Exits non-zero only
// on a crash, such as a missing variable or an unwritable data directory.

import { fileURLToPath } from "node:url";
import { indicators } from "../config/indicators.ts";
import { fetchers } from "./fetchers/index.ts";
import { run } from "./run.ts";

const REQUEST_TIMEOUT_MS = 30_000;

const userAgent = process.env.SEC_USER_AGENT;
if (!userAgent) {
  console.error(
    'SEC_USER_AGENT is not set. SEC requires contact info, e.g. SEC_USER_AGENT="AI Bubble Watch you@example.com".',
  );
  process.exit(1);
}

const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL("../data", import.meta.url));

// A stalled request would otherwise hang the job until GitHub's time limit.
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

const report = await run({
  indicators,
  fetchers,
  dataDir,
  ctx: { fetch: fetchWithTimeout, userAgent, now: new Date().toISOString() },
});

for (const { id, ok, error } of report.results) {
  if (ok) {
    console.log(`ok    ${id}`);
  } else {
    console.log(`FAIL  ${id}: ${error}`);
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::warning title=${id} fetch failed::${escapeWorkflowData(error ?? "")}`);
    }
  }
}

/** Workflow commands end at a newline, so escape it (and `%`, the escape character). */
function escapeWorkflowData(s: string): string {
  return s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}
