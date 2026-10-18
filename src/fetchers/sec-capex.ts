// SEC EDGAR XBRL fetcher for hyperscaler capex and operating cash flow.
// See docs/spec.md, "Hyperscaler capex".

import type { FetchContext, FetchResult, Point } from "../schema.ts";

/** CIKs and capex concepts from docs/research/data-sources.md. */
const companies = [
  { ticker: "MSFT", cik: 789019, capexConcept: "PaymentsToAcquirePropertyPlantAndEquipment" },
  // Amazon's PaymentsToAcquirePropertyPlantAndEquipment series stops in 2017.
  { ticker: "AMZN", cik: 1018724, capexConcept: "PaymentsToAcquireProductiveAssets" },
  { ticker: "GOOGL", cik: 1652044, capexConcept: "PaymentsToAcquirePropertyPlantAndEquipment" },
  { ticker: "META", cik: 1326801, capexConcept: "PaymentsToAcquirePropertyPlantAndEquipment" },
  { ticker: "ORCL", cik: 1341439, capexConcept: "PaymentsToAcquirePropertyPlantAndEquipment" },
];

const ocfConcept = "NetCashProvidedByUsedInOperatingActivities";

/** No single URL covers the ten requests, so points cite the API they all come from. */
export const secSourceUrl = "https://data.sec.gov/api/xbrl/companyconcept/";

/**
 * Fetches capex and operating cash flow for all five companies and rebuilds
 * the whole history. Requests go one at a time, well under SEC's limit of
 * 10 per second. The result replaces stored history, because every fetch
 * recomputes it from the latest-filed facts.
 */
export async function secCapex({ fetch, userAgent, now }: FetchContext): Promise<FetchResult> {
  const options = { fetch, userAgent };
  const input: CompanyQuarters[] = [];
  for (const { ticker, cik, capexConcept } of companies) {
    const capex = await fetchConcept(cik, capexConcept, options);
    const ocf = await fetchConcept(cik, ocfConcept, options);
    input.push({ ticker, capex: toQuarters(capex.units.USD), ocf: toQuarters(ocf.units.USD) });
  }
  return { mode: "replace", points: capexHistory(input, secSourceUrl, now) };
}

/** One fact from a companyconcept response's `units.USD` array. */
export interface Fact {
  start: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

/** Response from data.sec.gov/api/xbrl/companyconcept/CIK##########/us-gaap/{concept}.json */
export interface ConceptResponse {
  cik: number;
  tag: string;
  entityName: string;
  units: { USD: Fact[] };
}

export interface FetchOptions {
  fetch: typeof globalThis.fetch;
  /** SEC requires a User-Agent with contact info; requests without one get HTTP 403. */
  userAgent: string;
}

/** Fetches one us-gaap concept for one company from SEC's companyconcept API. */
export async function fetchConcept(
  cik: number,
  concept: string,
  { fetch, userAgent }: FetchOptions,
): Promise<ConceptResponse> {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${paddedCik}/us-gaap/${concept}.json`;
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) {
    throw new Error(`SEC CIK${paddedCik} ${concept}: HTTP ${response.status}`);
  }
  return (await response.json()) as ConceptResponse;
}

export interface Quarter {
  start: string;
  end: string;
  value: number;
}

/**
 * Turns cash-flow facts into one value per fiscal quarter.
 *
 * 10-Q cash-flow facts are mostly year-to-date, and 10-Ks report only the
 * full year, so each quarter is the difference between consecutive
 * year-to-date totals that share a fiscal-year start date.
 */
export function toQuarters(facts: Fact[]): Quarter[] {
  const byYearStart = new Map<string, Fact[]>();
  for (const fact of latestPerPeriod(facts)) {
    const group = byYearStart.get(fact.start) ?? [];
    group.push(fact);
    byYearStart.set(fact.start, group);
  }

  // Some companies also report 3-month or trailing-twelve-month facts, so a
  // quarter can be derived more than once, and differencing across a
  // trailing-twelve-month fact gives a span that isn't a quarter at all.
  // Keep only quarter-length spans, once each.
  const quarters = new Map<string, Quarter>();
  for (const group of byYearStart.values()) {
    group.sort((a, b) => a.end.localeCompare(b.end));
    let prev: Fact | undefined;
    for (const fact of group) {
      const q = prev
        ? { start: dayAfter(prev.end), end: fact.end, value: fact.val - prev.val }
        : { start: fact.start, end: fact.end, value: fact.val };
      const key = `${q.start}/${q.end}`;
      if (isQuarterLength(q) && !quarters.has(key)) quarters.set(key, q);
      prev = fact;
    }
  }
  return [...quarters.values()].sort((a, b) => a.end.localeCompare(b.end));
}

function isQuarterLength({ start, end }: Quarter): boolean {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  return days >= 80 && days <= 100;
}

export interface CompanyQuarters {
  ticker: string;
  capex: Quarter[];
  ocf: Quarter[];
}

/** One company's trailing-four-quarter totals. */
export interface CompanyTotals {
  ticker: string;
  periodStart: string;
  periodEnd: string;
  capex: number;
  ocf: number;
  ratio: number;
}

export interface CapexRatio {
  capex: number;
  ocf: number;
  ratio: number;
  companies: CompanyTotals[];
}

/** Capex as a share of operating cash flow over each company's latest four quarters. */
export function capexRatio(input: CompanyQuarters[]): CapexRatio {
  const companies = input.map(({ ticker, capex, ocf }) => {
    const capexQuarters = latestFour(capex, `${ticker} capex`);
    const ocfQuarters = latestFour(ocf, `${ticker} operating cash flow`);
    const capexEnd = capexQuarters.at(-1)!.end;
    const ocfEnd = ocfQuarters.at(-1)!.end;
    if (capexEnd !== ocfEnd) {
      throw new Error(`${ticker}: capex ends ${capexEnd} but operating cash flow ends ${ocfEnd}`);
    }
    const capexTotal = sum(capexQuarters);
    const ocfTotal = sum(ocfQuarters);
    return {
      ticker,
      periodStart: capexQuarters[0]!.start,
      periodEnd: capexQuarters.at(-1)!.end,
      capex: capexTotal,
      ocf: ocfTotal,
      ratio: capexTotal / ocfTotal,
    };
  });
  const capexTotal = companies.reduce((total, c) => total + c.capex, 0);
  const ocfTotal = companies.reduce((total, c) => total + c.ocf, 0);
  return { capex: capexTotal, ocf: ocfTotal, ratio: capexTotal / ocfTotal, companies };
}

/**
 * One point per calendar quarter end, from each company's latest fiscal
 * quarter ending on or before it. A calendar quarter gets a point only once
 * every company has a fiscal quarter ending within it, so Oracle's
 * Jun–Aug quarter waits for the others' Jul–Sep filings. Values are in %.
 *
 * An older calendar quarter whose four-quarter spans have a gap (a missing
 * or unusable filing, or history that starts too late) is skipped. A gap in
 * the newest one throws, so the card shows a failed fetch rather than
 * quietly falling back to an older quarter.
 */
export function capexHistory(companies: CompanyQuarters[], sourceUrl: string, fetchedAt: string): Point[] {
  const points: Point[] = [];
  const quarterEnds = reachedByAll(companies);
  for (const quarterEnd of quarterEnds) {
    const cut = (quarters: Quarter[]) => quarters.filter((q) => q.end <= quarterEnd);
    let result: CapexRatio;
    try {
      result = capexRatio(companies.map((c) => ({ ticker: c.ticker, capex: cut(c.capex), ocf: cut(c.ocf) })));
    } catch (err) {
      if (quarterEnd === quarterEnds.at(-1)) throw err;
      continue;
    }
    points.push({
      date: quarterEnd,
      value: result.ratio * 100,
      secondary: { capex: result.capex, ocf: result.ocf },
      breakdown: result.companies.map((c) => ({
        label: c.ticker,
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        values: { capex: c.capex, ocf: c.ocf, ratio: c.ratio * 100 },
      })),
      sourceUrl,
      fetchedAt,
    });
  }
  return points;
}

/** Calendar quarter ends, oldest first, within which every company has a fiscal quarter ending. */
function reachedByAll(companies: CompanyQuarters[]): string[] {
  const perCompany = companies.map(
    (c) => new Set([...c.capex, ...c.ocf].map((q) => calendarQuarterEnd(q.end))),
  );
  const [first = new Set<string>(), ...rest] = perCompany;
  return [...first].filter((end) => rest.every((ends) => ends.has(end))).sort();
}

/** "2026-08-31" → "2026-09-30". Day 0 of the month after the quarter is its last day. */
function calendarQuarterEnd(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const lastMonth = Math.ceil(month! / 3) * 3;
  return new Date(Date.UTC(year!, lastMonth, 0)).toISOString().slice(0, 10);
}

/**
 * The latest four quarters, which must be back to back. A missing filing
 * leaves a gap, and totaling across it would understate the year.
 */
function latestFour(quarters: Quarter[], label: string): Quarter[] {
  const four = quarters.slice(-4);
  const consecutive =
    four.length === 4 && four.every((q, i) => i === 0 || q.start === dayAfter(four[i - 1]!.end));
  if (!consecutive) {
    const periods = four.map((q) => `${q.start}..${q.end}`).join(", ");
    throw new Error(`${label}: latest four quarters aren't consecutive (${periods})`);
  }
  return four;
}

function sum(quarters: Quarter[]): number {
  return quarters.reduce((total, q) => total + q.value, 0);
}

/** Keeps only the most recently filed fact for each (start, end) period. */
function latestPerPeriod(facts: Fact[]): Fact[] {
  const latest = new Map<string, Fact>();
  for (const fact of facts) {
    const key = `${fact.start}/${fact.end}`;
    const seen = latest.get(key);
    if (!seen || fact.filed > seen.filed) latest.set(key, fact);
  }
  return [...latest.values()];
}

function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
