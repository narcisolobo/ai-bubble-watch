import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fedGzSpread, parseGzCsv } from "../src/fetchers/fed-gz-spread.ts";
import type { FetchContext } from "../src/schema.ts";

// The fixture is unedited rows of the Fed's ebp_csv.csv (header, 1973-01..02,
// 2024-02..03, 2026-07..09), fetched 2026-10-18. Expected values are copied
// from those rows; month ends are calendar facts (1973 isn't a leap year, 2024 is).

const csv = readFileSync(new URL("./fixtures/fed-gz/ebp.csv", import.meta.url), "utf8");
const sourceUrl = "https://www.federalreserve.gov/example.csv";
const fetchedAt = "2026-10-17T11:17:00Z";

const point = (periodStart: string, date: string, value: number, ebp: number) =>
  ({ date, periodStart, value, secondary: { ebp }, sourceUrl, fetchedAt });

const expected = [
  point("1973-01-01", "1973-01-31", 1.1307714053429057, -0.04758657214441975),
  point("1973-02-01", "1973-02-28", 1.075493276125443, -0.05699084055462),
  point("2024-02-01", "2024-02-29", 1.1103329785223546, -0.10385251920703388),
  point("2024-03-01", "2024-03-31", 1.0608161098804605, -0.06023425892642575),
  point("2026-07-01", "2026-07-31", 0.8415710676483904, -0.3096715865395149),
  point("2026-08-01", "2026-08-31", 0.8788529799959449, -0.2254507226190453),
  point("2026-09-01", "2026-09-30", 0.9259102941329188, -0.3919245963723856),
];

test("parseGzCsv returns one point per month, dated at month end, with the EBP as a secondary series", () => {
  assert.deepEqual(parseGzCsv(csv, sourceUrl, fetchedAt), expected);
});

test("parseGzCsv finds columns by header name, not position", () => {
  // Same rows with the columns in reverse order: est_prob,ebp,gz_spread,date.
  const reversed = csv.trimEnd().split("\n").map((line) => line.split(",").reverse().join(",")).join("\n");

  assert.deepEqual(parseGzCsv(reversed, sourceUrl, fetchedAt), expected);
});

test("parseGzCsv throws, naming the URL and date, on an empty or non-numeric value", () => {
  // The history has no gaps, and "replace" mode would delete a skipped month.
  const row = "2026-08-01,0.8788529799959449,-0.2254507226190453,";
  const broken = [
    csv.replace(row, "2026-08-01,,-0.2254507226190453,"),
    csv.replace(row, "2026-08-01,NA,-0.2254507226190453,"),
    csv.replace(row, "2026-08-01,0.8788529799959449,,"),
  ];

  for (const text of broken) {
    assert.notEqual(text, csv);
    assert.throws(() => parseGzCsv(text, sourceUrl, fetchedAt), (err: Error) =>
      err.message.includes(sourceUrl) && err.message.includes("2026-08-01"));
  }
});

test("parseGzCsv throws, naming the URL and column, when a column is missing", () => {
  for (const column of ["date", "gz_spread", "ebp"]) {
    const renamed = csv.replace(column, `${column}_v2`);
    assert.throws(() => parseGzCsv(renamed, sourceUrl, fetchedAt), (err: Error) =>
      err.message.includes(sourceUrl) && err.message.includes(`"${column}"`));
  }
});

const gzUrl = "https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv";

/** A stand-in for fetch that serves one response and records requested URLs. */
function serving(response: Response) {
  const requested: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    requested.push(String(input));
    return response;
  };
  return { fetch, requested };
}

function context(fetch: FetchContext["fetch"], now: string): FetchContext {
  return { fetch, userAgent: "AI Bubble Watch test@example.com", now };
}

test("fedGzSpread fetches the Fed's CSV and replaces the stored history with every month", async () => {
  const now = "2026-10-17T11:17:00Z";
  const { fetch, requested } = serving(new Response(csv));

  const result = await fedGzSpread(context(fetch, now));

  assert.deepEqual(requested, [gzUrl]);
  assert.equal(result.mode, "replace");
  assert.deepEqual(
    result.points.map((p) => [p.date, p.value, p.sourceUrl, p.fetchedAt]),
    expected.map((p) => [p.date, p.value, gzUrl, now]),
  );
});

test("fedGzSpread throws on a non-200 response, naming the status", async () => {
  const { fetch } = serving(new Response("<html>Service Unavailable</html>", { status: 503 }));

  await assert.rejects(fedGzSpread(context(fetch, "2026-10-17T11:17:00Z")), (err: Error) =>
    /503/.test(err.message));
});
