import { test } from "node:test";
import assert from "node:assert/strict";
import { cardStatus, summarize, thresholdStatus, type CardStatus } from "../src/status.ts";
import type { IndicatorConfig, IndicatorData, Point, Thresholds } from "../src/schema.ts";
import { indicators } from "../config/indicators.ts";

// Threshold values are the spec's: capex ratio watch ≥ 75%, alert ≥ 100%,
// and "a value at the threshold counts as crossing it".

const higherIsWorse: Thresholds = { direction: "higher-is-worse", watch: 75, alert: 100, rationale: "" };

test("thresholdStatus, higher-is-worse: a value at a threshold crosses it", () => {
  const status = (value: number) => thresholdStatus(higherIsWorse, value, 1);

  assert.equal(status(36), "normal");
  assert.equal(status(74.9), "normal");
  assert.equal(status(75), "watch");
  assert.equal(status(75.1), "watch");
  assert.equal(status(99.9), "watch");
  assert.equal(status(100), "alert");
  assert.equal(status(100.1), "alert");
});

test("thresholdStatus, lower-is-worse: a value at a threshold crosses it", () => {
  // No v1 indicator is lower-is-worse; these thresholds are made up for the test.
  const lowerIsWorse: Thresholds = { direction: "lower-is-worse", watch: 2, alert: 1, rationale: "" };
  const status = (value: number) => thresholdStatus(lowerIsWorse, value, 1);

  assert.equal(status(3.5), "normal");
  assert.equal(status(2.1), "normal");
  assert.equal(status(2), "watch");
  assert.equal(status(1.9), "watch");
  assert.equal(status(1.1), "watch");
  assert.equal(status(1), "alert");
  assert.equal(status(0.9), "alert");
});

test("thresholdStatus without thresholds is 'no-threshold'", () => {
  assert.equal(thresholdStatus(undefined, 1_000_000, 1), "no-threshold");
});

test("thresholdStatus compares the value as displayed, rounded to the indicator's decimals", () => {
  // GZ spread: watch ≥ 2.0, shown with 2 decimals. 1.996 displays as "2.00",
  // so the card mustn't call it normal; 1.994 displays as "1.99".
  const gz: Thresholds = { direction: "higher-is-worse", watch: 2, alert: 3, rationale: "" };
  assert.equal(thresholdStatus(gz, 1.996, 2), "watch");
  assert.equal(thresholdStatus(gz, 1.994, 2), "normal");

  const lowerIsWorse: Thresholds = { direction: "lower-is-worse", watch: 2, alert: 1, rationale: "" };
  assert.equal(thresholdStatus(lowerIsWorse, 2.004, 2), "watch"); // "2.00"
  assert.equal(thresholdStatus(lowerIsWorse, 2.006, 2), "normal"); // "2.01"
});

// The real Treasury config, with maxAgeDays pinned so a config edit doesn't break these tests.
const treasury: IndicatorConfig = { ...indicators.find((i) => i.id === "treasury-10y")!, maxAgeDays: 6 };

function point(date: string, value: number): Point {
  return { date, value, sourceUrl: "https://home.treasury.gov/example.csv", fetchedAt: "2026-10-16T11:17:00Z" };
}

function data(points: Point[], lastAttempt: IndicatorData["lastAttempt"] = { at: "2026-10-16T11:17:00Z", ok: true }): IndicatorData {
  return { id: "treasury-10y", points, lastSuccessAt: "2026-10-16T11:17:00Z", lastAttempt };
}

test("cardStatus flags a card stale only when its latest date is more than maxAgeDays old", () => {
  // Latest point Fri 2026-10-16; maxAgeDays 6. Age counts whole UTC days.
  const card = data([point("2026-10-15", 5.1), point("2026-10-16", 5.09)]);
  const stale = (now: string) => cardStatus(treasury, card, now).stale;

  assert.equal(stale("2026-10-22T00:00:00Z"), false); // 6 days
  assert.equal(stale("2026-10-22T23:59:59Z"), false); // still 6 days
  assert.equal(stale("2026-10-23T00:00:00Z"), true); // 7 days
});

test("cardStatus reports the latest point and its status", () => {
  const card = data([point("2026-10-15", 5.1), point("2026-10-16", 4.99)]);

  const result = cardStatus(treasury, card, "2026-10-17T11:17:00Z");

  assert.deepEqual(result.latest, point("2026-10-16", 4.99));
  assert.equal(result.status, "normal"); // Treasury watch is ≥ 5.0
});

test("cardStatus flags a failed last attempt and keeps the last good point", () => {
  const failed = data([point("2026-10-16", 5.09)], { at: "2026-10-17T11:17:00Z", ok: false, error: "HTTP 503" });
  const neverTried = { ...data([point("2026-10-16", 5.09)]), lastAttempt: null };

  const result = cardStatus(treasury, failed, "2026-10-17T11:17:00Z");

  assert.equal(result.fetchFailed, true);
  assert.deepEqual(result.latest, point("2026-10-16", 5.09));
  assert.equal(result.status, "watch");
  assert.equal(cardStatus(treasury, data([point("2026-10-16", 5.09)]), "2026-10-17T11:17:00Z").fetchFailed, false);
  assert.equal(cardStatus(treasury, neverTried, "2026-10-17T11:17:00Z").fetchFailed, false);
});

test("cardStatus with no points yet has no status and is stale", () => {
  // No file yet (readData returns null), or a file whose fetches have all failed.
  const now = "2026-10-17T11:17:00Z";
  const allFailed: IndicatorData = {
    id: "treasury-10y",
    points: [],
    lastSuccessAt: null,
    lastAttempt: { at: now, ok: false, error: "HTTP 503" },
  };

  assert.deepEqual(cardStatus(treasury, null, now), { latest: null, status: null, stale: true, fetchFailed: false });
  assert.deepEqual(cardStatus(treasury, allFailed, now), { latest: null, status: null, stale: true, fetchFailed: true });
});

test("summarize counts each status, finds the newest success, and lists failed and stale cards", () => {
  const card = (status: CardStatus["status"], flags: Partial<CardStatus> = {}): CardStatus =>
    ({ latest: status ? point("2026-10-16", 1) : null, status, stale: false, fetchFailed: false, ...flags });

  const summary = summarize([
    { id: "capex", lastSuccessAt: "2026-10-17T11:17:04.120Z", card: card("normal") },
    { id: "treasury", lastSuccessAt: "2026-10-16T11:17:03.000Z", card: card("watch", { fetchFailed: true }) },
    { id: "gz", lastSuccessAt: "2026-10-17T11:17:05.010Z", card: card("no-threshold", { stale: true }) },
    { id: "new", lastSuccessAt: null, card: card(null, { stale: true, fetchFailed: true }) },
  ]);

  assert.deepEqual(summary, {
    counts: { normal: 1, watch: 1, alert: 0, "no-threshold": 1 },
    lastSuccessAt: "2026-10-17T11:17:05.010Z",
    failed: ["treasury", "new"],
    stale: ["gz", "new"],
  });
});

test("summarize with no successful fetch anywhere has no last success time", () => {
  const card: CardStatus = { latest: null, status: null, stale: true, fetchFailed: true };

  assert.equal(summarize([{ id: "new", lastSuccessAt: null, card }]).lastSuccessAt, null);
});
