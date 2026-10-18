import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  capexHistory,
  capexRatio,
  fetchConcept,
  secCapex,
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

const sourceUrl = "https://data.sec.gov/api/xbrl/companyconcept/";
const fetchedAt = "2026-10-17T11:17:00Z";

test("capexHistory's latest point is the newest calendar quarter all five companies have reached", () => {
  // Oracle's Jun–Aug quarter falls in calendar Q3 2026, which the other four
  // haven't reported yet, so the latest point is Q2 2026, with Oracle's FY2026
  // (to May 31). Totals hand-worked as in the test above; Oracle's FY2026 is
  // its 10-K: capex 55,663, operating cash flow 31,977.
  const points = capexHistory(["MSFT", "AMZN", "GOOGL", "META", "ORCL"].map(company), sourceUrl, fetchedAt);
  const latest = points.at(-1)!;

  assert.equal(latest.date, "2026-06-30");
  assert.equal(latest.value.toFixed(4), "81.8104"); // 566,366 ÷ 692,291
  assert.deepEqual(latest.secondary, { capex: 566_366 * M, ocf: 692_291 * M });
  assert.deepEqual(
    latest.breakdown!.map(({ label, periodStart, periodEnd, values }) => [label, periodStart, periodEnd, values.capex, values.ocf]),
    [
      ["MSFT", "2025-07-01", "2026-06-30", 115_948 * M, 182_935 * M],
      ["AMZN", "2025-07-01", "2026-06-30", 173_028 * M, 161_403 * M],
      ["GOOGL", "2025-07-01", "2026-06-30", 132_402 * M, 185_675 * M],
      ["META", "2025-07-01", "2026-06-30", 89_325 * M, 130_301 * M],
      ["ORCL", "2025-06-01", "2026-05-31", 55_663 * M, 31_977 * M],
    ],
  );
  // Per-company ratios are in %, like the point's value.
  assert.equal(latest.breakdown!.find((row) => row.label === "ORCL")!.values.ratio!.toFixed(2), "174.07");
  assert.equal(latest.sourceUrl, sourceUrl);
  assert.equal(latest.fetchedAt, fetchedAt);
  assert.equal(latest.periodStart, undefined);
});

/** Back-to-back quarters ending on the given dates; each starts the day after the one before. */
function quarters(firstStart: string, ends: string[], values: number[]) {
  return ends.map((end, i) => ({ start: i === 0 ? firstStart : dayAfter(ends[i - 1]!), end, value: values[i]! }));
}

function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

test("capexHistory places each fiscal quarter in the calendar quarter it ends in", () => {
  // DEC's quarters end on calendar quarter ends; MAY's, like Oracle's, end
  // in Feb, May, Aug, and Nov, which fall in calendar Q1, Q2, Q3, and Q4.
  // Hand-worked combined ratios, each from the latest four quarters on or before the date:
  //   2025-12-31: (10+20+30+40 + 1+2+3+4) ÷ (400 + 40) = 110 ÷ 440 = 25%
  //   2026-03-31: (20+30+40+50 + 2+3+4+5) ÷ 440 = 154 ÷ 440 = 35%
  //   2026-06-30: (30+40+50+60 + 3+4+5+6) ÷ 440 = 198 ÷ 440 = 45%
  // MAY's Aug 2026 quarter is in calendar Q3, which DEC hasn't reached.
  const decEnds = ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"];
  const mayEnds = ["2025-02-28", "2025-05-31", "2025-08-31", "2025-11-30", "2026-02-28", "2026-05-31", "2026-08-31"];
  const dec = {
    ticker: "DEC",
    capex: quarters("2025-01-01", decEnds, [10, 20, 30, 40, 50, 60]),
    ocf: quarters("2025-01-01", decEnds, [100, 100, 100, 100, 100, 100]),
  };
  const may = {
    ticker: "MAY",
    capex: quarters("2024-12-01", mayEnds, [1, 2, 3, 4, 5, 6, 7]),
    ocf: quarters("2024-12-01", mayEnds, [10, 10, 10, 10, 10, 10, 10]),
  };

  const points = capexHistory([dec, may], sourceUrl, fetchedAt);

  assert.deepEqual(
    points.map((p) => [p.date, p.value.toFixed(1)]),
    [["2025-12-31", "25.0"], ["2026-03-31", "35.0"], ["2026-06-30", "45.0"]],
  );
  assert.deepEqual(
    points.map((p) => p.breakdown!.find((row) => row.label === "MAY")!).map((row) => [row.periodStart, row.periodEnd]),
    [["2024-12-01", "2025-11-30"], ["2025-03-01", "2026-02-28"], ["2025-06-01", "2026-05-31"]],
  );
});

test("capexHistory skips older calendar quarters whose latest four quarters have a gap", () => {
  // DEC is missing Apr–Jun 2025, so every four-quarter span through Mar 2026
  // crosses the gap; Jul 2025–Jun 2026 doesn't: (30+40+50+60 + 3+4+5+6) ÷ 440 = 45%.
  const decEnds = ["2025-03-31", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"];
  const mayEnds = ["2025-02-28", "2025-05-31", "2025-08-31", "2025-11-30", "2026-02-28", "2026-05-31"];
  const dec = {
    ticker: "DEC",
    capex: [{ start: "2025-01-01", end: "2025-03-31", value: 10 }, ...quarters("2025-07-01", decEnds.slice(1), [30, 40, 50, 60])],
    ocf: [{ start: "2025-01-01", end: "2025-03-31", value: 100 }, ...quarters("2025-07-01", decEnds.slice(1), [100, 100, 100, 100])],
  };
  const may = {
    ticker: "MAY",
    capex: quarters("2024-12-01", mayEnds, [1, 2, 3, 4, 5, 6]),
    ocf: quarters("2024-12-01", mayEnds, [10, 10, 10, 10, 10, 10]),
  };

  const points = capexHistory([dec, may], sourceUrl, fetchedAt);

  assert.deepEqual(points.map((p) => [p.date, p.value.toFixed(1)]), [["2026-06-30", "45.0"]]);
});

test("capexHistory throws, naming the company, when the newest calendar quarter has a gap", () => {
  // DEC is missing Jan–Mar 2026 but has Apr–Jun, so Q2 2026 is reached by
  // both companies and can't be totaled. Showing Q4 2025 instead would hide it.
  const decEnds = ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-06-30"];
  const mayEnds = ["2025-02-28", "2025-05-31", "2025-08-31", "2025-11-30", "2026-02-28", "2026-05-31"];
  const decQuarters = (values: number[]) => [
    ...quarters("2025-01-01", decEnds.slice(0, 4), values.slice(0, 4)),
    { start: "2026-04-01", end: "2026-06-30", value: values[4]! },
  ];
  const dec = { ticker: "DEC", capex: decQuarters([10, 20, 30, 40, 60]), ocf: decQuarters([100, 100, 100, 100, 100]) };
  const may = {
    ticker: "MAY",
    capex: quarters("2024-12-01", mayEnds, [1, 2, 3, 4, 5, 6]),
    ocf: quarters("2024-12-01", mayEnds, [10, 10, 10, 10, 10, 10]),
  };

  assert.throws(() => capexHistory([dec, may], sourceUrl, fetchedAt), /DEC/);
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

// CIKs and concepts from docs/research/data-sources.md. Amazon's
// PaymentsToAcquirePropertyPlantAndEquipment series stops in 2017.
const conceptUrl = (cik: string, concept: string) =>
  `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`;
const capexConcept = "PaymentsToAcquirePropertyPlantAndEquipment";
const ocfConcept = "NetCashProvidedByUsedInOperatingActivities";
const fixtureUrls: Record<string, string> = {
  [conceptUrl("0000789019", capexConcept)]: "msft-capex",
  [conceptUrl("0000789019", ocfConcept)]: "msft-ocf",
  [conceptUrl("0001018724", "PaymentsToAcquireProductiveAssets")]: "amzn-capex",
  [conceptUrl("0001018724", ocfConcept)]: "amzn-ocf",
  [conceptUrl("0001652044", capexConcept)]: "googl-capex",
  [conceptUrl("0001652044", ocfConcept)]: "googl-ocf",
  [conceptUrl("0001326801", capexConcept)]: "meta-capex",
  [conceptUrl("0001326801", ocfConcept)]: "meta-ocf",
  [conceptUrl("0001341439", capexConcept)]: "orcl-capex",
  [conceptUrl("0001341439", ocfConcept)]: "orcl-ocf",
};

/** A stand-in for fetch that serves the SEC fixtures by URL and records requests. */
function servingFixtures(override: Record<string, Response> = {}) {
  const requests: Request[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    const response = override[request.url];
    if (response) return response;
    const name = fixtureUrls[request.url];
    return name ? Response.json(fixture(name)) : new Response("Not Found", { status: 404 });
  };
  return { fetch, requests };
}

test("secCapex fetches all ten concepts and replaces the stored history", async () => {
  const now = "2026-10-17T11:17:00Z";
  const { fetch, requests } = servingFixtures();

  const result = await secCapex({ fetch, userAgent, now });

  assert.deepEqual(requests.map((r) => r.url).sort(), Object.keys(fixtureUrls).sort());
  assert.ok(requests.every((r) => r.headers.get("user-agent") === userAgent));
  assert.equal(result.mode, "replace");
  const latest = result.points.at(-1)!;
  assert.deepEqual([latest.date, latest.value.toFixed(4), latest.sourceUrl, latest.fetchedAt], [
    "2026-06-30",
    "81.8104",
    "https://data.sec.gov/api/xbrl/companyconcept/",
    now,
  ]);
  assert.deepEqual(latest.breakdown!.map((row) => row.label), ["MSFT", "AMZN", "GOOGL", "META", "ORCL"]);
});

test("secCapex fails when any one of the ten requests fails", async () => {
  // A ratio missing one company would look plausible but be wrong.
  const { fetch } = servingFixtures({
    [conceptUrl("0001341439", ocfConcept)]: new Response("Forbidden", { status: 403 }),
  });

  await assert.rejects(secCapex({ fetch, userAgent, now: "2026-10-17T11:17:00Z" }), (err: Error) =>
    /0001341439/.test(err.message) && /403/.test(err.message));
});
