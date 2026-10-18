// Card status, stale and fetch-failed flags, and the summary bar's counts.
// See docs/spec.md, "Indicator cards" and "Summary bar".

import type { IndicatorConfig, IndicatorData, Point, Thresholds } from "./schema.ts";

export type Status = "normal" | "watch" | "alert" | "no-threshold";

export interface CardStatus {
  /** Null before the indicator's first successful fetch. */
  latest: Point | null;
  /** Null when there's no value to judge; such a card isn't counted in the summary. */
  status: Status | null;
  /** The latest point's `date` is more than `maxAgeDays` whole UTC days before now, or there's no point. */
  stale: boolean;
  /** The last refresh attempt failed; `latest` is still the last good point. */
  fetchFailed: boolean;
}

/** `data` is null when the indicator has no data file yet. */
export function cardStatus(config: IndicatorConfig, data: IndicatorData | null, now: string): CardStatus {
  const latest = data?.points.at(-1) ?? null;
  const fetchFailed = data?.lastAttempt?.ok === false;
  if (!latest) return { latest: null, status: null, stale: true, fetchFailed };
  return {
    latest,
    status: thresholdStatus(config.thresholds, latest.value, config.decimals),
    stale: daysBetween(latest.date, now) > config.maxAgeDays,
    fetchFailed,
  };
}

/** Whole UTC calendar days from `date` (YYYY-MM-DD) to the day `now` falls on. */
function daysBetween(date: string, now: string): number {
  const today = Date.parse(now.slice(0, 10));
  return Math.round((today - Date.parse(date)) / 86_400_000);
}

/**
 * A value equal to a threshold counts as crossing it. The value is compared
 * as the card displays it, rounded to `decimals`, so a GZ spread of 1.996
 * shown as "2.00" is at the 2.0 watch line, not below it.
 */
export function thresholdStatus(thresholds: Thresholds | undefined, value: number, decimals: number): Status {
  if (!thresholds) return "no-threshold";
  const shown = Number(value.toFixed(decimals));
  const crosses = (threshold: number) =>
    thresholds.direction === "higher-is-worse" ? shown >= threshold : shown <= threshold;
  if (crosses(thresholds.alert)) return "alert";
  if (crosses(thresholds.watch)) return "watch";
  return "normal";
}

export interface SummaryInput {
  id: string;
  /** From the indicator's data file; null if it has never fetched successfully. */
  lastSuccessAt: string | null;
  card: CardStatus;
}

export interface Summary {
  /** Cards with no status yet (no points) aren't counted. */
  counts: Record<Status, number>;
  /** Newest `lastSuccessAt` across indicators, standing in for the last successful run. */
  lastSuccessAt: string | null;
  /** Indicator ids, in input order. */
  failed: string[];
  stale: string[];
}

export function summarize(inputs: SummaryInput[]): Summary {
  const counts: Record<Status, number> = { normal: 0, watch: 0, alert: 0, "no-threshold": 0 };
  let lastSuccessAt: string | null = null;
  for (const { card, lastSuccessAt: at } of inputs) {
    if (card.status) counts[card.status] += 1;
    if (at && (!lastSuccessAt || Date.parse(at) > Date.parse(lastSuccessAt))) lastSuccessAt = at;
  }
  return {
    counts,
    lastSuccessAt,
    failed: inputs.filter((i) => i.card.fetchFailed).map((i) => i.id),
    stale: inputs.filter((i) => i.card.stale).map((i) => i.id),
  };
}
