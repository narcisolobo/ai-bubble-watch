import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indicators } from "../config/indicators.ts";
import { run } from "../src/run.ts";
import { readData, writeData } from "../src/store.ts";
import type { FetchContext, Fetcher, FetcherId, Point } from "../src/schema.ts";

const now = "2026-10-17T11:17:00Z";
const earlier = "2026-10-16T11:17:00Z";

const ctx: FetchContext = {
  fetch: async () => {
    throw new Error("stand-in fetchers shouldn't make HTTP requests");
  },
  userAgent: "AI Bubble Watch test@example.com",
  now,
};

function point(date: string, value: number, fetchedAt = now): Point {
  return { date, value, sourceUrl: "https://example.gov/data.csv", fetchedAt };
}

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "abw-run-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("run applies each indicator's fetch result to its data file and reports success", async (t) => {
  const dataDir = tempDir(t);
  await writeData(dataDir, {
    id: "treasury-10y",
    points: [point("2026-10-15", 5.1, earlier)],
    lastSuccessAt: earlier,
    lastAttempt: { at: earlier, ok: true },
  });

  const seen: FetchContext[] = [];
  const returning = (result: Awaited<ReturnType<Fetcher>>): Fetcher => async (c) => {
    seen.push(c);
    return result;
  };
  const fetchers: Record<FetcherId, Fetcher> = {
    "sec-capex": returning({ mode: "merge", points: [point("2026-06-30", 82.9)] }),
    "treasury-yield": returning({ mode: "merge", points: [point("2026-10-16", 5.09)] }),
    "fed-gz-spread": returning({ mode: "replace", points: [point("2026-09-30", 0.93)] }),
  };

  const report = await run({ indicators, fetchers, dataDir, ctx });

  assert.deepEqual(report, {
    results: [
      { id: "hyperscaler-capex-ratio", ok: true },
      { id: "treasury-10y", ok: true },
      { id: "gz-credit-spread", ok: true },
    ],
  });
  assert.equal(seen.length, 3);
  assert.ok(seen.every((c) => c === ctx), "every fetcher gets the same context");

  assert.deepEqual(await readData(dataDir, "treasury-10y"), {
    id: "treasury-10y",
    points: [point("2026-10-15", 5.1, earlier), point("2026-10-16", 5.09)],
    lastSuccessAt: now,
    lastAttempt: { at: now, ok: true },
  });
  assert.deepEqual((await readData(dataDir, "hyperscaler-capex-ratio"))?.points, [point("2026-06-30", 82.9)]);
  assert.deepEqual((await readData(dataDir, "gz-credit-spread"))?.points, [point("2026-09-30", 0.93)]);
});

/** Fetchers that each return one point, with any overridden. */
function fetchersWith(overrides: Partial<Record<FetcherId, Fetcher>> = {}): Record<FetcherId, Fetcher> {
  return {
    "sec-capex": async () => ({ mode: "merge", points: [point("2026-06-30", 82.9)] }),
    "treasury-yield": async () => ({ mode: "merge", points: [point("2026-10-16", 5.09)] }),
    "fed-gz-spread": async () => ({ mode: "replace", points: [point("2026-09-30", 0.93)] }),
    ...overrides,
  };
}

const treasuryYesterday = {
  id: "treasury-10y",
  points: [point("2026-10-15", 5.1, earlier)],
  lastSuccessAt: earlier,
  lastAttempt: { at: earlier, ok: true },
};

test("run records a failing fetcher, keeps its last good points, and still updates the others", async (t) => {
  const dataDir = tempDir(t);
  await writeData(dataDir, treasuryYesterday);
  const fetchers = fetchersWith({
    "treasury-yield": async () => {
      throw new Error("Treasury CSV: HTTP 503");
    },
  });

  const report = await run({ indicators, fetchers, dataDir, ctx });

  assert.deepEqual(report, {
    results: [
      { id: "hyperscaler-capex-ratio", ok: true },
      { id: "treasury-10y", ok: false, error: "Treasury CSV: HTTP 503" },
      { id: "gz-credit-spread", ok: true },
    ],
  });
  assert.deepEqual(await readData(dataDir, "treasury-10y"), {
    ...treasuryYesterday,
    lastAttempt: { at: now, ok: false, error: "Treasury CSV: HTTP 503" },
  });
  assert.equal((await readData(dataDir, "gz-credit-spread"))?.lastSuccessAt, now);
});

test("run records a fetcher that returns no points as a failure instead of crashing", async (t) => {
  const dataDir = tempDir(t);
  await writeData(dataDir, treasuryYesterday);
  const fetchers = fetchersWith({ "treasury-yield": async () => ({ mode: "replace", points: [] }) });

  const report = await run({ indicators, fetchers, dataDir, ctx });

  assert.deepEqual(report.results[1], { id: "treasury-10y", ok: false, error: "treasury-10y: fetch returned no points" });
  assert.deepEqual((await readData(dataDir, "treasury-10y"))?.points, treasuryYesterday.points);
  assert.equal(report.results[2]?.ok, true);
});

test("run leaves a corrupt data file untouched, reports it, and still updates the others", async (t) => {
  // Writing a failure record would overwrite history that's recoverable from git.
  const dataDir = tempDir(t);
  const corrupt = '{\n  "id": "treasury-10y",\n  "points": [';
  writeFileSync(join(dataDir, "treasury-10y.json"), corrupt);

  const report = await run({ indicators, fetchers: fetchersWith(), dataDir, ctx });

  assert.equal(report.results[1]?.id, "treasury-10y");
  assert.equal(report.results[1]?.ok, false);
  assert.match(report.results[1]?.error ?? "", /treasury-10y\.json/);
  assert.equal(readFileSync(join(dataDir, "treasury-10y.json"), "utf8"), corrupt);
  assert.equal(report.results[2]?.ok, true);
});
