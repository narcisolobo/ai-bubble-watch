// Federal Reserve Board GZ spread and excess bond premium (EBP) fetcher.
// See docs/spec.md, "Corporate credit spread".

import type { FetchContext, FetchResult, Point } from "../schema.ts";

export const gzCsvUrl = "https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv";

/** The Fed revises the whole history each month, so the result replaces it. */
export async function fedGzSpread({ fetch, now }: FetchContext): Promise<FetchResult> {
  const response = await fetch(gzCsvUrl);
  if (!response.ok) throw new Error(`Fed GZ spread CSV: HTTP ${response.status}`);
  return { mode: "replace", points: parseGzCsv(await response.text(), gzCsvUrl, now) };
}

/**
 * Parses the Fed's ebp_csv.csv into monthly GZ spread points.
 *
 * Each row's date is the first of its month. A point is dated at the
 * month's end, with `periodStart` the first, per the spec's Storage section.
 * Columns are found by header name, so a reordered file still parses.
 */
export function parseGzCsv(text: string, sourceUrl: string, fetchedAt: string): Point[] {
  const [header = "", ...rows] = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const columns = header.split(",").map((name) => name.trim());
  const indexOf = (name: string) => {
    const index = columns.indexOf(name);
    if (index === -1) {
      throw new Error(`${sourceUrl}: no "${name}" column (columns: ${columns.join(", ")})`);
    }
    return index;
  };
  const dateColumn = indexOf("date");
  const gzColumn = indexOf("gz_spread");
  const ebpColumn = indexOf("ebp");

  return rows.map((row) => {
    const fields = row.split(",");
    const periodStart = fields[dateColumn]!.trim();
    // Every month has both values, so a blank is a format change, not a gap.
    // Skipping it would also delete that month, since this source replaces history.
    const number = (column: number, name: string) => {
      const raw = (fields[column] ?? "").trim();
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) {
        throw new Error(`${sourceUrl}: "${name}" value "${raw}" on ${periodStart} isn't a number`);
      }
      return value;
    };
    return {
      date: monthEnd(periodStart),
      periodStart,
      value: number(gzColumn, "gz_spread"),
      secondary: { ebp: number(ebpColumn, "ebp") },
      sourceUrl,
      fetchedAt,
    };
  });
}

/** "2024-02-01" → "2024-02-29". Day 0 of the next month is this month's last day. */
function monthEnd(firstOfMonth: string): string {
  const [year, month] = firstOfMonth.split("-").map(Number);
  return new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
}
