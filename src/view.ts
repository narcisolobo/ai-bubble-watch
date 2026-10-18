// Pure helpers for the page build: escaping, formatting, change, sparklines,
// and scenario grouping. See docs/spec.md, "Core Features" and "Stack".

import type { IndicatorConfig, Point, Scenario, Thresholds } from "./schema.ts";

export interface ScenarioGroup {
  scenario: Scenario;
  /** Cards shown here: indicators whose first scenario this is. */
  indicators: IndicatorConfig[];
  /** Indicators that also relate to this scenario, with the scenario their card is under. */
  alsoRelevant: { indicator: IndicatorConfig; home: Scenario }[];
}

/**
 * Groups cards by scenario, in config order. Each card appears once, under
 * its first scenario; its other scenarios link to it. Scenarios with no
 * indicator at all are listed separately, so gaps in coverage show.
 */
export function scenarioGroups(
  scenarios: Scenario[],
  indicators: IndicatorConfig[],
): { groups: ScenarioGroup[]; uncovered: Scenario[] } {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const groups: ScenarioGroup[] = [];
  const uncovered: Scenario[] = [];
  for (const scenario of scenarios) {
    const group: ScenarioGroup = {
      scenario,
      indicators: indicators.filter((i) => i.scenarios[0] === scenario.id),
      alsoRelevant: indicators
        .filter((i) => i.scenarios.indexOf(scenario.id) > 0)
        .map((indicator) => ({ indicator, home: byId.get(indicator.scenarios[0]!)! })),
    };
    if (group.indicators.length + group.alsoRelevant.length === 0) uncovered.push(scenario);
    else groups.push(group);
  }
  return { groups, uncovered };
}

export interface Change {
  delta: number;
  /** The point the latest is compared with. */
  from: Point;
}

/**
 * The latest value's change over the indicator's comparison period: against
 * the newest point on or before `days` before the latest date, or against
 * the point `points` back. Null when the history doesn't reach that far.
 */
export function change(points: Point[], period: IndicatorConfig["changePeriod"]): Change | null {
  const latest = points.at(-1);
  if (!latest) return null;
  let from: Point | undefined;
  if ("days" in period) {
    const cutoff = new Date(`${latest.date}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - period.days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    from = points.findLast((p) => p.date <= cutoffDate);
  } else {
    from = points.at(-1 - period.points);
  }
  return from ? { delta: latest.value - from.value, from } : null;
}

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** The one HTML-escape helper. Every inserted value goes through it. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => escapes[char]!);
}

/**
 * A value in its units. `%` rounds with toFixed, the same rounding
 * thresholdStatus uses, so the shown number and the status agree. USD is
 * shown in millions, billions, or trillions.
 */
export function formatValue(value: number, units: string, decimals: number): string {
  if (units === "USD") {
    const [divisor, suffix] =
      Math.abs(value) >= 1e12 ? [1e12, "T"] : Math.abs(value) >= 1e9 ? [1e9, "B"] : [1e6, "M"];
    return `${signed(value / divisor, decimals, "$")}${suffix}`;
  }
  return `${signed(value, decimals)}${units}`;
}

export const sparklineWidth = 120;
export const sparklineHeight = 32;

export interface Sparkline {
  /** SVG path data in a sparklineWidth × sparklineHeight viewBox. */
  main: string;
  overlay?: string;
  /** Range of the main series in the window, for the label. The overlay only widens the scale. */
  low: number;
  high: number;
  first: Point;
  last: Point;
  /**
   * Where the thresholds and the latest value sit, as fractions of the
   * height from the bottom (0 to 1). Only when thresholds were passed.
   */
  levels?: { watch: number; alert: number; latest: number };
}

/**
 * Path data for the trend line. Points are spaced by index, not by date, so
 * weekends and holidays don't leave flat gaps. `years` keeps only the
 * window back from the latest date; `overlay` names a `secondary` series
 * drawn on the same scale. `thresholds` widen the scale to take in both
 * levels and an alert stage as tall as the watch stage, so the stages can
 * be drawn behind the line. Null when there are fewer than two points.
 */
export function sparkline(
  points: Point[],
  options: { years?: number; overlay?: string; thresholds?: Omit<Thresholds, "rationale"> },
): Sparkline | null {
  let window = points;
  const latest = points.at(-1);
  if (latest && options.years !== undefined) {
    const cutoff = new Date(`${latest.date}T00:00:00Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - options.years);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    window = points.filter((p) => p.date >= cutoffDate);
  }
  if (window.length < 2) return null;

  const main = window.map((p) => p.value);
  const overlay = options.overlay ? window.map((p) => p.secondary?.[options.overlay!] ?? Number.NaN) : undefined;
  const t = options.thresholds;
  // Past the alert level by the watch stage's height, on whichever side is worse.
  const stages = t ? [t.watch, t.alert, t.alert + (t.alert - t.watch)] : [];
  const all = [...main, ...(overlay ?? []), ...stages].filter(Number.isFinite);
  const bottom = Math.min(...all);
  const top = Math.max(...all);
  // Finer than the path's rounding, so bands drawn from levels meet the line at any height.
  const fraction = (value: number) => Number(((value - bottom) / (top - bottom)).toFixed(4));
  const step = sparklineWidth / (window.length - 1);
  const y = (value: number) =>
    top === bottom ? sparklineHeight / 2 : sparklineHeight - ((value - bottom) / (top - bottom)) * sparklineHeight;
  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${round(i * step)},${round(y(v))}`).join("");

  return {
    main: path(main),
    ...(overlay ? { overlay: path(overlay) } : {}),
    low: Math.min(...main),
    high: Math.max(...main),
    first: window[0]!,
    last: window.at(-1)!,
    ...(t ? { levels: { watch: fraction(t.watch), alert: fraction(t.alert), latest: fraction(main.at(-1)!) } } : {}),
  };
}

function round(n: number): number {
  return Number(n.toFixed(2));
}

// Dates are calendar dates, so format them in UTC: in local time west of
// UTC, "2026-01-01" would read as Dec 31.
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" });

/** A point's as-of label. A period value is dated by its period's end. */
export function formatPeriod(date: string, frequency: IndicatorConfig["frequency"]): string {
  const at = new Date(`${date}T00:00:00Z`);
  if (frequency === "daily") return dayFormat.format(at);
  if (frequency === "monthly") return monthFormat.format(at);
  return `Q${Math.ceil((at.getUTCMonth() + 1) / 3)} ${at.getUTCFullYear()}`;
}

/** A period by month, e.g. a company's fiscal year: "Jun 2025 – May 2026". */
export function formatRange(start: string, end: string): string {
  const month = (date: string) => monthFormat.format(new Date(`${date}T00:00:00Z`));
  return `${month(start)} – ${month(end)}`;
}

/** A change, always signed. A change in a % value is in percentage points. */
export function formatChange(delta: number, units: string, decimals: number): string {
  const text = formatValue(delta, units, decimals).replace(/%$/, " pp");
  return delta > 0 && Number(Math.abs(delta).toFixed(decimals)) !== 0 ? `+${text}` : text;
}

/** toFixed with a true minus sign (U+2212) placed before any prefix, and no "−0.00". */
function signed(value: number, decimals: number, prefix = ""): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const isZero = Number(fixed) === 0;
  return `${value < 0 && !isZero ? "−" : ""}${prefix}${fixed}`;
}
