// U.S. Treasury daily yield curve fetcher for the 10-year yield.
// See docs/spec.md, "10-year Treasury yield".

import type { FetchContext, FetchResult, Point } from "../schema.ts";

export function treasuryCsvUrl(year: number): string {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

/**
 * Fetches this year's and last year's files. Two years covers the sparkline
 * and the 90-day change, and last year's file keeps early January, before
 * the new year has any rows, from coming back empty.
 */
export async function treasuryYield({ fetch, now }: FetchContext): Promise<FetchResult> {
  const year = new Date(now).getUTCFullYear();
  const perYear = await Promise.all(
    [year - 1, year].map(async (y) => {
      const url = treasuryCsvUrl(y);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Treasury ${y} CSV: HTTP ${response.status}`);
      return parseTreasuryCsv(await response.text(), url, now);
    }),
  );
  return { mode: "merge", points: perYear.flat() };
}

/**
 * Parses one year's daily yield curve CSV into 10-year yield points.
 *
 * Rows are newest first with MM/DD/YYYY dates. Columns are found by header
 * name, because Treasury adds maturities over time (e.g. "1.5 Month" in
 * 2025), which shifts the "10 Yr" column's position.
 */
export function parseTreasuryCsv(text: string, sourceUrl: string, fetchedAt: string): Point[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  // A year with no rows yet comes back as HTTP 200 with an empty body.
  if (lines.length === 0) return [];
  const [header = "", ...rows] = lines;
  const columns = header.split(",").map((name) => name.replaceAll('"', "").trim());
  const tenYear = columns.indexOf("10 Yr");
  if (tenYear === -1) {
    throw new Error(`${sourceUrl}: no "10 Yr" column (columns: ${columns.join(", ")})`);
  }

  const points: Point[] = [];
  for (const row of rows) {
    const fields = row.split(",");
    // An empty field would otherwise become Number("") === 0.
    const raw = (fields[tenYear] ?? "").trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`${sourceUrl}: "10 Yr" value "${raw}" on ${fields[0]} isn't a number`);
    }
    const [month, day, year] = fields[0]!.split("/");
    points.push({ date: `${year}-${month}-${day}`, value, sourceUrl, fetchedAt });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
