import { test } from "node:test";
import assert from "node:assert/strict";
import { change, scenarioGroups, sparkline, escapeHtml, formatChange, formatPeriod, formatRange, formatValue } from "../src/view.ts";
import type { IndicatorConfig, Point } from "../src/schema.ts";
import { indicators, scenarios } from "../config/indicators.ts";

test("escapeHtml escapes the five characters that matter in text and attributes", () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script> & 'y'`),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
  );
  // & goes first, so an existing entity is escaped once, not left as-is.
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  assert.equal(escapeHtml("S&P 500 ÷ 10"), "S&amp;P 500 ÷ 10");
});

test("formatValue shows % values with the indicator's decimals and a true minus sign", () => {
  // Latest live values: capex ratio 81.8104…, 10-year 5.09, GZ 0.9259…, EBP −0.3919….
  assert.equal(formatValue(81.81044, "%", 1), "81.8%");
  assert.equal(formatValue(5.09, "%", 2), "5.09%");
  assert.equal(formatValue(0.9259102941329188, "%", 2), "0.93%");
  assert.equal(formatValue(-0.3919245963723856, "%", 2), "\u22120.39%");
  // A tiny negative that rounds to zero shouldn't show as "\u22120.00%".
  assert.equal(formatValue(-0.001, "%", 2), "0.00%");
});

test("formatValue shows USD in millions, billions, or trillions", () => {
  // Combined capex 566,366M and ORCL FY2026 capex 55,663M, from the capex tests.
  assert.equal(formatValue(566_366_000_000, "USD", 1), "$566.4B");
  assert.equal(formatValue(55_663_000_000, "USD", 1), "$55.7B");
  assert.equal(formatValue(1_234_500_000_000, "USD", 1), "$1.2T");
  assert.equal(formatValue(850_000_000, "USD", 1), "$850.0M");
});

test("formatChange shows a change in a % value in percentage points, always signed", () => {
  assert.equal(formatChange(0.12, "%", 2), "+0.12 pp");
  assert.equal(formatChange(-1.3, "%", 2), "\u22121.30 pp");
  assert.equal(formatChange(0, "%", 2), "0.00 pp");
  assert.equal(formatChange(-0.001, "%", 2), "0.00 pp");
});

test("formatPeriod labels a point by its indicator's frequency", () => {
  // A point is dated by its period's end (spec, Storage).
  assert.equal(formatPeriod("2026-10-16", "daily"), "Oct 16, 2026");
  assert.equal(formatPeriod("2026-09-30", "monthly"), "Sep 2026");
  assert.equal(formatPeriod("2026-06-30", "quarterly"), "Q2 2026");
  assert.equal(formatPeriod("2025-12-31", "quarterly"), "Q4 2025");
});

test("formatPeriod and formatRange use UTC, whatever the build machine's time zone", () => {
  // West of UTC, a local-time format would show New Year's Day as Dec 31.
  const saved = process.env.TZ;
  process.env.TZ = "Pacific/Honolulu";
  try {
    assert.equal(formatPeriod("2026-01-01", "daily"), "Jan 1, 2026");
    assert.equal(formatPeriod("2026-03-31", "quarterly"), "Q1 2026");
    assert.equal(formatRange("2025-06-01", "2026-05-31"), "Jun 2025 \u2013 May 2026");
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test("formatRange shows a company's fiscal period by month", () => {
  // Oracle's FY2026 and Microsoft's FY2026, as in the capex tests.
  assert.equal(formatRange("2025-06-01", "2026-05-31"), "Jun 2025 \u2013 May 2026");
  assert.equal(formatRange("2025-07-01", "2026-06-30"), "Jul 2025 \u2013 Jun 2026");
});

const at = (date: string, value: number): Point =>
  ({ date, value, sourceUrl: "https://example.gov/data.csv", fetchedAt: "2026-10-17T11:17:00Z" });

test("change over { days } compares with the newest point on or before that many days back", () => {
  // Treasury "10 Yr" rows from the 2026 CSV. 90 days before Fri Oct 16 is
  // Sat Jul 18, so the comparison is Fri Jul 17: 5.09 − 4.55 = 0.54.
  const points = [at("2026-07-16", 4.57), at("2026-07-17", 4.55), at("2026-07-20", 4.6), at("2026-10-15", 5.1), at("2026-10-16", 5.09)];

  const result = change(points, { days: 90 })!;

  assert.equal(result.from.date, "2026-07-17");
  assert.equal(result.delta.toFixed(2), "0.54");
  // Exactly 90 days back counts: Jul 17 → Oct 15 is 90 days.
  assert.equal(change(points.slice(0, 4), { days: 90 })!.from.date, "2026-07-17");
});

test("change over { points } compares with the point that many back", () => {
  const points = [at("2026-03-31", 1), at("2026-04-30", 2), at("2026-05-31", 3), at("2026-06-30", 4), at("2026-07-31", 5)];

  const result = change(points, { points: 3 })!;

  assert.equal(result.from.date, "2026-04-30");
  assert.equal(result.delta, 3);
});

test("change is null when the history is too short", () => {
  assert.equal(change([at("2026-07-20", 4.6), at("2026-10-16", 5.09)], { days: 90 }), null);
  assert.equal(change([at("2026-05-31", 3), at("2026-06-30", 4)], { points: 3 }), null);
  assert.equal(change([], { points: 1 }), null);
});

// The sparkline's viewBox is 120 × 32; y = 0 is the top.

test("sparkline scales the window's low to the bottom and its high to the top", () => {
  const result = sparkline([at("2026-01-31", 1), at("2026-02-28", 3), at("2026-03-31", 2)], {})!;

  assert.equal(result.main, "M0,32L60,0L120,16");
  assert.deepEqual([result.low, result.high], [1, 3]);
  assert.deepEqual([result.first.date, result.last.date], ["2026-01-31", "2026-03-31"]);
});

test("sparkline draws a flat series as a line across the middle", () => {
  const result = sparkline([at("2026-01-31", 2), at("2026-02-28", 2)], {})!;

  assert.equal(result.main, "M0,16L120,16");
});

test("sparkline keeps only the last `years` of history, counted back from the latest date", () => {
  // Two years back from 2026-10-16 is 2024-10-16, which is kept.
  const points = [at("2024-10-15", 9), at("2024-10-16", 1), at("2025-10-16", 3), at("2026-10-16", 2)];

  const result = sparkline(points, { years: 2 })!;

  assert.equal(result.first.date, "2024-10-16");
  assert.equal(result.main, "M0,32L60,0L120,16");
});

test("sparkline draws an overlay series on the same scale as the main one", () => {
  // GZ spread with the EBP: the EBP's −1 sets the bottom of the scale for
  // both lines, but low and high describe the main series alone.
  const withEbp = (date: string, value: number, ebp: number): Point => ({ ...at(date, value), secondary: { ebp } });
  const points = [withEbp("2026-07-31", 1, -1), withEbp("2026-08-31", 3, 0), withEbp("2026-09-30", 2, 1)];

  const result = sparkline(points, { overlay: "ebp" })!;

  assert.deepEqual([result.low, result.high], [1, 3]);
  assert.equal(result.main, "M0,16L60,0L120,8");
  assert.equal(result.overlay, "M0,32L60,24L120,16");
});

test("sparkline is null with fewer than two points to draw", () => {
  assert.equal(sparkline([at("2026-10-16", 5.09)], {}), null);
  assert.equal(sparkline([], {}), null);
});

test("scenarioGroups puts each card under its first scenario and lists the uncovered ones", () => {
  // Matches the spec's scenario table: three scenarios have a v1 indicator,
  // three don't.
  const { groups, uncovered } = scenarioGroups(scenarios, indicators);

  assert.deepEqual(
    groups.map((g) => ({
      scenario: g.scenario.id,
      cards: g.indicators.map((i) => i.id),
      also: g.alsoRelevant.map((a) => [a.indicator.id, a.home.id]),
    })),
    [
      { scenario: "revenue-vs-capex", cards: ["hyperscaler-capex-ratio"], also: [] },
      { scenario: "debt-stress", cards: ["gz-credit-spread"], also: [["hyperscaler-capex-ratio", "revenue-vs-capex"]] },
      { scenario: "macro-shock", cards: ["treasury-10y"], also: [["gz-credit-spread", "debt-stress"]] },
    ],
  );
  assert.deepEqual(uncovered.map((s) => s.id), ["gpu-oversupply", "valuation", "commoditization"]);
});

test("scenarioGroups keeps a scenario covered only as a second scenario", () => {
  const capex = indicators.find((i) => i.id === "hyperscaler-capex-ratio")!;
  const onlyCapex: IndicatorConfig[] = [capex];

  const { groups, uncovered } = scenarioGroups(scenarios, onlyCapex);

  assert.deepEqual(groups.map((g) => [g.scenario.id, g.indicators.length, g.alsoRelevant.length]), [
    ["revenue-vs-capex", 1, 0],
    ["debt-stress", 0, 1],
  ]);
  assert.deepEqual(uncovered.map((s) => s.id), ["gpu-oversupply", "valuation", "macro-shock", "commoditization"]);
});
