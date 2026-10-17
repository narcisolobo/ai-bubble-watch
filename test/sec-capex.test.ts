import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  capexRatio,
  fetchConcept,
  toQuarters,
  type CompanyQuarters,
  type ConceptResponse,
} from "../src/fetchers/sec-capex.ts";

const M = 1_000_000;

function fixture(name: string): ConceptResponse {
  const url = new URL(`./fixtures/sec/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

// Expected values come from outside the code under test: earnings press
// releases (8-K Exhibit 99.1) where available, otherwise worked by hand
// from the company's reported totals (e.g. Q4 = 10-K full year − 9-month
// year-to-date), as noted per test.

test("toQuarters derives Oracle's quarters from year-to-date-only facts", () => {
  const quarters = toQuarters(fixture("orcl-capex").units.USD);

  assert.deepEqual(quarters, [
    { start: "2025-06-01", end: "2025-08-31", value: 8_502 * M },
    { start: "2025-09-01", end: "2025-11-30", value: 12_033 * M },
    { start: "2025-12-01", end: "2026-02-28", value: 18_635 * M },
    { start: "2026-03-01", end: "2026-05-31", value: 16_493 * M },
    { start: "2026-06-01", end: "2026-08-31", value: 28_499 * M },
  ]);
});

test("toQuarters ignores trailing-twelve-month facts and doesn't duplicate reported quarters", () => {
  // Amazon files 3-month, year-to-date, and trailing-twelve-month facts.
  // Q4 2025 isn't reported directly; Amazon's own trailing-twelve-month
  // fact to 2026-06-30 (173,028) equals the sum of the last four quarters.
  const quarters = toQuarters(fixture("amzn-capex").units.USD);

  assert.deepEqual(quarters, [
    { start: "2025-01-01", end: "2025-03-31", value: 25_019 * M },
    { start: "2025-04-01", end: "2025-06-30", value: 32_183 * M },
    { start: "2025-07-01", end: "2025-09-30", value: 35_095 * M },
    { start: "2025-10-01", end: "2025-12-31", value: 39_522 * M },
    { start: "2026-01-01", end: "2026-03-31", value: 44_203 * M },
    { start: "2026-04-01", end: "2026-06-30", value: 54_208 * M },
  ]);
});

test("toQuarters matches published quarters for Alphabet, Microsoft, and Meta", () => {
  const valueFor = (name: string, end: string) =>
    toQuarters(fixture(name).units.USD).find((q) => q.end === end)?.value;

  assert.equal(valueFor("googl-capex", "2025-12-31"), 27_851 * M); // Q4 = FY − 9 months
  assert.equal(valueFor("googl-capex", "2026-06-30"), 44_924 * M);
  assert.equal(valueFor("msft-capex", "2026-06-30"), 35_802 * M); // fiscal Q4 FY2026
  assert.equal(valueFor("meta-ocf", "2026-06-30"), 31_862 * M);
});

function company(ticker: string): CompanyQuarters {
  const t = ticker.toLowerCase();
  return {
    ticker,
    capex: toQuarters(fixture(`${t}-capex`).units.USD),
    ocf: toQuarters(fixture(`${t}-ocf`).units.USD),
  };
}

test("capexRatio sums a company's latest four quarters", () => {
  // Microsoft's fiscal year ends June 30, so its last four quarters are
  // exactly its FY2026 10-K: capex 115,948, operating cash flow 182,935.
  const { companies } = capexRatio([company("MSFT")]);
  assert.equal(companies.length, 1);
  const { ratio, ...msft } = companies[0]!;

  assert.deepEqual(msft, {
    ticker: "MSFT",
    periodStart: "2025-07-01",
    periodEnd: "2026-06-30",
    capex: 115_948 * M,
    ocf: 182_935 * M,
  });
  assert.equal(ratio.toFixed(4), "0.6338");
});

test("capexRatio combines all five companies' trailing-four-quarter totals", () => {
  // Hand-worked as full year − prior year-to-date + current year-to-date,
  // from each company's reported totals (Amazon reports trailing twelve
  // months directly). Oracle's latest quarter ends Aug 31; the rest, Jun 30.
  const expected = [
    { ticker: "MSFT", periodEnd: "2026-06-30", capex: 115_948, ocf: 182_935 },
    { ticker: "AMZN", periodEnd: "2026-06-30", capex: 173_028, ocf: 161_403 },
    { ticker: "GOOGL", periodEnd: "2026-06-30", capex: 91_447 - 39_643 + 80_598, ocf: 164_713 - 63_897 + 84_859 },
    { ticker: "META", periodEnd: "2026-06-30", capex: 69_691 - 29_479 + 49_113, ocf: 115_800 - 49_587 + 64_088 },
    { ticker: "ORCL", periodEnd: "2026-08-31", capex: 55_663 - 8_502 + 28_499, ocf: 31_977 - 8_140 + 23_103 },
  ];

  const result = capexRatio(expected.map((e) => company(e.ticker)));

  assert.deepEqual(
    result.companies.map(({ ticker, periodEnd, capex, ocf }) => ({ ticker, periodEnd, capex, ocf })),
    expected.map((e) => ({ ...e, capex: e.capex * M, ocf: e.ocf * M })),
  );
  assert.equal(result.capex, 586_363 * M);
  assert.equal(result.ocf, 707_254 * M);
  assert.equal(result.ratio.toFixed(4), "0.8291");
});

test("capexRatio refuses to total a company whose latest four quarters have a gap", () => {
  // Without Oracle's Q2 FY2026 10-Q, Sep–Nov and Dec–Feb can't be derived.
  const withoutQ2 = (name: string) =>
    toQuarters(fixture(name).units.USD.filter((f) => f.end !== "2025-11-30"));
  const orcl = { ticker: "ORCL", capex: withoutQ2("orcl-capex"), ocf: withoutQ2("orcl-ocf") };

  assert.throws(() => capexRatio([company("MSFT"), orcl]), /ORCL/);
});

test("capexRatio refuses to divide capex and cash flow from different periods", () => {
  // Oracle's operating cash flow without its Q1 FY2027 fact still has four
  // consecutive quarters, but they end a quarter before its capex does.
  const orcl = {
    ...company("ORCL"),
    ocf: toQuarters(fixture("orcl-ocf").units.USD.filter((f) => f.end !== "2026-08-31")),
  };

  assert.throws(() => capexRatio([orcl]), /ORCL/);
});

/** A stand-in for fetch that records requests and replies with `response`. */
function fakeFetch(response: () => Response) {
  const requests: Request[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return response();
  };
  return { fetch, requests };
}

const userAgent = "AI Bubble Watch test@example.com";

test("fetchConcept requests the company's concept with a User-Agent and returns the parsed body", async () => {
  const body = fixture("orcl-capex");
  const { fetch, requests } = fakeFetch(() => Response.json(body));

  const result = await fetchConcept(1341439, "PaymentsToAcquirePropertyPlantAndEquipment", { fetch, userAgent });

  assert.deepEqual(result, body);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]!.url,
    "https://data.sec.gov/api/xbrl/companyconcept/CIK0001341439/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment.json",
  );
  assert.equal(requests[0]!.headers.get("user-agent"), userAgent);
});

test("fetchConcept throws on a non-200 response, naming the company, concept, and status", async () => {
  const { fetch } = fakeFetch(() => new Response("Forbidden", { status: 403 }));

  await assert.rejects(
    fetchConcept(1341439, "PaymentsToAcquirePropertyPlantAndEquipment", { fetch, userAgent }),
    (err: Error) =>
      /0001341439/.test(err.message) &&
      /PaymentsToAcquirePropertyPlantAndEquipment/.test(err.message) &&
      /403/.test(err.message),
  );
});
