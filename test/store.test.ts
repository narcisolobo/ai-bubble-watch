import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFailure, applySuccess, readData, writeData } from "../src/store.ts";
import type { IndicatorData, Point } from "../src/schema.ts";

const sourceUrl = "https://example.gov/data.csv";

function point(date: string, value: number, fetchedAt = "2026-10-15T11:17:00Z"): Point {
  return { date, value, sourceUrl, fetchedAt };
}

function stored(points: Point[]): IndicatorData {
  return {
    id: "treasury-10y",
    points,
    lastSuccessAt: "2026-10-15T11:17:00Z",
    lastAttempt: { at: "2026-10-15T11:17:00Z", ok: true },
  };
}

const at = "2026-10-16T11:17:00Z";

test("applySuccess merges by date: revised values replace old ones, new dates are added, the rest are kept", () => {
  const existing = stored([point("2026-10-14", 5.05), point("2026-10-15", 5.1)]);

  const result = applySuccess(existing, "treasury-10y", {
    mode: "merge",
    points: [point("2026-10-16", 5.09, at), point("2026-10-15", 5.11, at)],
  }, at);

  assert.deepEqual(result, {
    id: "treasury-10y",
    points: [point("2026-10-14", 5.05), point("2026-10-15", 5.11, at), point("2026-10-16", 5.09, at)],
    lastSuccessAt: at,
    lastAttempt: { at, ok: true },
  });
});

test("applySuccess with replace keeps only the new points, sorted", () => {
  // The Fed can revise, or drop, any month of the GZ spread's history.
  const existing = stored([point("2026-07-31", 0.88), point("2026-08-31", 0.9)]);

  const result = applySuccess(existing, "gz-credit-spread", {
    mode: "replace",
    points: [point("2026-09-30", 0.93, at), point("2026-08-31", 0.88, at)],
  }, at);

  assert.deepEqual(result.points, [point("2026-08-31", 0.88, at), point("2026-09-30", 0.93, at)]);
});

test("applySuccess refuses a result with no points, so a parsing bug can't wipe the history", () => {
  const existing = stored([point("2026-08-31", 0.9)]);

  for (const mode of ["merge", "replace"] as const) {
    assert.throws(
      () => applySuccess(existing, "gz-credit-spread", { mode, points: [] }, at),
      /gz-credit-spread/,
    );
  }
});

test("applySuccess on the first run creates the file contents", () => {
  const result = applySuccess(null, "treasury-10y", { mode: "merge", points: [point("2026-10-16", 5.09, at)] }, at);

  assert.deepEqual(result, {
    id: "treasury-10y",
    points: [point("2026-10-16", 5.09, at)],
    lastSuccessAt: at,
    lastAttempt: { at, ok: true },
  });
});

test("applyFailure records the failed attempt and keeps the last good points", () => {
  const existing = stored([point("2026-10-14", 5.05), point("2026-10-15", 5.1)]);

  const result = applyFailure(existing, "treasury-10y", "HTTP 503", at);

  assert.deepEqual(result, {
    id: "treasury-10y",
    points: [point("2026-10-14", 5.05), point("2026-10-15", 5.1)],
    lastSuccessAt: "2026-10-15T11:17:00Z",
    lastAttempt: { at, ok: false, error: "HTTP 503" },
  });
});

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), "abw-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("readData returns null when the indicator has no data file yet", async (t) => {
  assert.equal(await readData(tempDir(t), "treasury-10y"), null);
});

test("writeData writes data/{id}.json as stable, indented JSON that readData reads back", async (t) => {
  const dir = tempDir(t);
  const data: IndicatorData = {
    id: "treasury-10y",
    points: [point("2026-10-16", 5.09, at)],
    lastSuccessAt: at,
    lastAttempt: { at, ok: true },
  };

  await writeData(dir, data);

  assert.deepEqual(await readData(dir, "treasury-10y"), data);
  assert.equal(
    readFileSync(join(dir, "treasury-10y.json"), "utf8"),
    `{
  "id": "treasury-10y",
  "points": [
    {
      "date": "2026-10-16",
      "value": 5.09,
      "sourceUrl": "https://example.gov/data.csv",
      "fetchedAt": "2026-10-16T11:17:00Z"
    }
  ],
  "lastSuccessAt": "2026-10-16T11:17:00Z",
  "lastAttempt": {
    "at": "2026-10-16T11:17:00Z",
    "ok": true
  }
}
`,
  );
  assert.deepEqual(readdirSync(dir), ["treasury-10y.json"], "no temporary files left behind");
});

test("readData throws, naming the file, when the data file is corrupt", async (t) => {
  // Treating a corrupt file as missing would let the next write replace the history.
  const dir = tempDir(t);
  writeFileSync(join(dir, "treasury-10y.json"), '{\n  "id": "treasury-10y",\n  "points": [');

  await assert.rejects(readData(dir, "treasury-10y"), /treasury-10y\.json/);
});

test("applyFailure on the first run records the failure with no points", () => {
  assert.deepEqual(applyFailure(null, "treasury-10y", "HTTP 503", at), {
    id: "treasury-10y",
    points: [],
    lastSuccessAt: null,
    lastAttempt: { at, ok: false, error: "HTTP 503" },
  });
});
