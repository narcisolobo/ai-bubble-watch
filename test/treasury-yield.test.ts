import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTreasuryCsv, treasuryYield } from "../src/fetchers/treasury-yield.ts";
import type { FetchContext } from "../src/schema.ts";

// Fixtures are unedited slices of Treasury's daily yield curve CSVs.
// Expected values are read off the "10 Yr" column of those rows.

function fixture(year: number): string {
  return readFileSync(new URL(`./fixtures/treasury/${year}.csv`, import.meta.url), "utf8");
}

const sourceUrl = "https://home.treasury.gov/example.csv";
const fetchedAt = "2026-10-17T11:17:00Z";

test("parseTreasuryCsv returns the 10-year yield per day, oldest first, with ISO dates", () => {
  assert.deepEqual(parseTreasuryCsv(fixture(2026), sourceUrl, fetchedAt), [
    { date: "2026-10-14", value: 5.19, sourceUrl, fetchedAt },
    { date: "2026-10-15", value: 5.1, sourceUrl, fetchedAt },
    { date: "2026-10-16", value: 5.09, sourceUrl, fetchedAt },
  ]);
});

test("parseTreasuryCsv finds the 10-year column by name across column layouts", () => {
  // 2024 has no "1.5 Month" column, so "10 Yr" sits one position earlier.
  // 2025's January rows leave "1.5 Month" empty.
  const values = (year: number) => parseTreasuryCsv(fixture(year), sourceUrl, fetchedAt).map((p) => [p.date, p.value]);

  assert.deepEqual(values(2024), [["2024-12-30", 4.55], ["2024-12-31", 4.58]]);
  assert.deepEqual(values(2025), [["2025-01-02", 4.57], ["2025-01-03", 4.6], ["2025-12-30", 4.14], ["2025-12-31", 4.18]]);
});

test("parseTreasuryCsv skips days with no 10-year value instead of recording zero", () => {
  const text = fixture(2026).replace("4.98,5.09,5.47", "4.98,,5.47");

  assert.deepEqual(
    parseTreasuryCsv(text, sourceUrl, fetchedAt).map((p) => p.date),
    ["2026-10-14", "2026-10-15"],
  );
});

test("parseTreasuryCsv throws, naming the URL, when the format changes", () => {
  const renamed = fixture(2026).replace('"10 Yr"', '"10 Year"');
  const notANumber = fixture(2026).replace("4.98,5.09,5.47", "4.98,N/A,5.47");

  assert.throws(() => parseTreasuryCsv(renamed, sourceUrl, fetchedAt), (err: Error) =>
    err.message.includes(sourceUrl) && err.message.includes("10 Yr"));
  assert.throws(() => parseTreasuryCsv(notANumber, sourceUrl, fetchedAt), (err: Error) =>
    err.message.includes(sourceUrl) && err.message.includes("N/A"));
});

const yearUrl = (year: number) =>
  `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;

/** A stand-in for fetch that serves CSV text by URL and records requested URLs. */
function serving(files: Record<string, string | Response>) {
  const requested: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    const file = files[url];
    if (file === undefined) return new Response("Not Found", { status: 404 });
    return typeof file === "string" ? new Response(file) : file;
  };
  return { fetch, requested };
}

function context(fetch: FetchContext["fetch"], now: string): FetchContext {
  return { fetch, userAgent: "AI Bubble Watch test@example.com", now };
}

test("treasuryYield merges this year's and last year's 10-year yields", async () => {
  const now = "2026-10-17T11:17:00Z";
  const { fetch, requested } = serving({ [yearUrl(2026)]: fixture(2026), [yearUrl(2025)]: fixture(2025) });

  const result = await treasuryYield(context(fetch, now));

  assert.deepEqual(requested.sort(), [yearUrl(2025), yearUrl(2026)]);
  assert.equal(result.mode, "merge");
  assert.deepEqual(
    result.points.map((p) => [p.date, p.value, p.sourceUrl, p.fetchedAt]),
    [
      ["2025-01-02", 4.57, yearUrl(2025), now],
      ["2025-01-03", 4.6, yearUrl(2025), now],
      ["2025-12-30", 4.14, yearUrl(2025), now],
      ["2025-12-31", 4.18, yearUrl(2025), now],
      ["2026-10-14", 5.19, yearUrl(2026), now],
      ["2026-10-15", 5.1, yearUrl(2026), now],
      ["2026-10-16", 5.09, yearUrl(2026), now],
    ],
  );
});

test("treasuryYield in early January returns last year's points while the new year's file is empty", async () => {
  // Treasury answers a year with no rows yet with HTTP 200 and an empty body
  // (checked 2026-10-17 against the 2027 file). Year boundaries are UTC.
  const now = "2026-01-01T00:30:00Z";
  const { fetch } = serving({ [yearUrl(2026)]: "", [yearUrl(2025)]: fixture(2025) });

  const result = await treasuryYield(context(fetch, now));

  assert.deepEqual(
    result.points.map((p) => p.date),
    ["2025-01-02", "2025-01-03", "2025-12-30", "2025-12-31"],
  );
});

test("treasuryYield throws on a non-200 response, naming the year and status", async () => {
  const { fetch } = serving({
    [yearUrl(2026)]: new Response("<html>Service Unavailable</html>", { status: 503 }),
    [yearUrl(2025)]: fixture(2025),
  });

  await assert.rejects(treasuryYield(context(fetch, "2026-10-17T11:17:00Z")), (err: Error) =>
    /2026/.test(err.message) && /503/.test(err.message));
});
