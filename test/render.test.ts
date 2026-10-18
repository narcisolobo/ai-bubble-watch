import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, renderPage } from "../src/render.ts";
import { indicators, scenarios } from "../config/indicators.ts";
import type { IndicatorData, Point } from "../src/schema.ts";

// Data is hand-built from real values: capex totals from the SEC tests,
// Treasury "10 Yr" rows from the 2026 CSV, GZ rows from the Fed's CSV.

const M = 1_000_000;
const now = "2026-10-18T11:17:00Z";
const ok = { at: "2026-10-18T11:17:04Z", ok: true };

function file(id: string, points: Point[], lastAttempt: IndicatorData["lastAttempt"] = ok): IndicatorData {
  return { id, points, lastSuccessAt: "2026-10-18T11:17:04Z", lastAttempt };
}

const capexPoint = (date: string, value: number, extra: Partial<Point> = {}): Point => ({
  date,
  value,
  sourceUrl: "https://data.sec.gov/api/xbrl/companyconcept/",
  fetchedAt: ok.at,
  ...extra,
});

const capex = file("hyperscaler-capex-ratio", [
  capexPoint("2025-06-30", 60.8),
  capexPoint("2025-09-30", 64.0),
  capexPoint("2025-12-31", 68.3),
  capexPoint("2026-03-31", 75.3),
  capexPoint("2026-06-30", 81.81044, {
    secondary: { capex: 566_366 * M, ocf: 692_291 * M },
    breakdown: [
      { label: "MSFT", periodStart: "2025-07-01", periodEnd: "2026-06-30", values: { capex: 115_948 * M, ocf: 182_935 * M, ratio: 63.38 } },
      { label: "ORCL", periodStart: "2025-06-01", periodEnd: "2026-05-31", values: { capex: 55_663 * M, ocf: 31_977 * M, ratio: 174.07 } },
    ],
  }),
]);

const treasuryUrl = "https://home.treasury.gov/example.csv";
const treasury = file("treasury-10y", [
  { date: "2026-07-17", value: 4.55, sourceUrl: treasuryUrl, fetchedAt: ok.at },
  { date: "2026-10-15", value: 5.1, sourceUrl: treasuryUrl, fetchedAt: ok.at },
  { date: "2026-10-16", value: 5.09, sourceUrl: treasuryUrl, fetchedAt: ok.at },
]);

const gzUrl = "https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv";
const gz = file("gz-credit-spread", [
  { date: "2026-07-31", periodStart: "2026-07-01", value: 0.8415710676483904, secondary: { ebp: -0.3096715865395149 }, sourceUrl: gzUrl, fetchedAt: ok.at },
  { date: "2026-08-31", periodStart: "2026-08-01", value: 0.8788529799959449, secondary: { ebp: -0.2254507226190453 }, sourceUrl: gzUrl, fetchedAt: ok.at },
  { date: "2026-09-30", periodStart: "2026-09-01", value: 0.9259102941329188, secondary: { ebp: -0.3919245963723856 }, sourceUrl: gzUrl, fetchedAt: ok.at },
]);

function page(data: Record<string, IndicatorData | null> = { [capex.id]: capex, [treasury.id]: treasury, [gz.id]: gz }, config = indicators) {
  return renderPage(buildModel({ scenarios, indicators: config, data: new Map(Object.entries(data)), now }));
}

/** The first element with this id, through its closing tag. Fine here: cards and sections don't nest their own kind. */
function element(html: string, tag: string, id: string): string {
  const match = html.match(new RegExp(`<${tag} id="${id}"[^>]*>[\\s\\S]*?</${tag}>`));
  assert.ok(match, `no <${tag} id="${id}">`);
  return match[0];
}

test("renderPage lays out a header with the summary, a section per scenario, and a card per indicator", () => {
  const html = page();

  assert.match(html, /^<!doctype html>\n<html lang="en">/);
  assert.match(html, /<header>[\s\S]*<h1>AI Bubble Watch<\/h1>[\s\S]*<section id="summary"[\s\S]*<\/header>/);
  assert.match(html, /<main>[\s\S]*<\/main>\s*<footer>[\s\S]*<\/footer>\s*<\/body>/);

  // Each card once, as an <article> with an <h3>, under its first scenario.
  const revenue = element(html, "section", "revenue-vs-capex");
  assert.match(revenue, /<h2[^>]*>Revenue not catching up to capex<\/h2>/);
  assert.match(element(revenue, "article", "hyperscaler-capex-ratio"), /<h3[^>]*>Hyperscaler capex vs\. operating cash flow<\/h3>/);
  assert.match(element(element(html, "section", "debt-stress"), "article", "gz-credit-spread"), /<h3/);
  assert.match(element(element(html, "section", "macro-shock"), "article", "treasury-10y"), /<h3/);
  assert.equal(html.match(/<article /g)?.length, 3);

  // A card's other scenarios link to it.
  assert.match(element(html, "section", "debt-stress"), /<a href="#hyperscaler-capex-ratio">Hyperscaler capex vs\. operating cash flow<\/a>/);
  assert.match(element(html, "section", "macro-shock"), /<a href="#gz-credit-spread">Corporate credit spread<\/a>/);

  // Scenarios with no indicator are listed, not hidden.
  const uncovered = element(html, "section", "uncovered");
  for (const name of ["GPU oversupply / depreciation", "Valuation pressure", "Commoditization / price wars"]) {
    assert.ok(uncovered.includes(`<li>${name}</li>`), name);
  }
});

/** Text content with tags removed, the five escapes decoded, and whitespace collapsed. */
function text(html: string): string {
  const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => entities[entity]!)
    .replace(/\s+/g, " ")
    .trim();
}

test("renderPage states each card's status and flags in words, and summarizes them", () => {
  const failedTreasury = { ...treasury, lastAttempt: { at: "2026-10-18T11:17:04Z", ok: false, error: "HTTP 503" } };
  const staleGz = { ...gz, points: gz.points.slice(0, 2) }; // Aug 31 is 48 days before Oct 18; the limit is 45.

  const html = page({ [capex.id]: capex, [treasury.id]: failedTreasury, [gz.id]: staleGz });

  const capexCard = element(html, "article", "hyperscaler-capex-ratio");
  assert.match(capexCard, /^<article id="hyperscaler-capex-ratio"[^>]* data-status="watch"/);
  assert.match(text(capexCard), /Status: Watch/);
  assert.doesNotMatch(text(capexCard), /Stale|Fetch failed/);

  const treasuryCard = element(html, "article", "treasury-10y");
  assert.match(text(treasuryCard), /Status: Watch/); // 5.09% ≥ 5.0%
  assert.match(text(treasuryCard), /Fetch failed/);
  assert.match(text(treasuryCard), /5\.09%/); // the last good value stays visible

  const gzCard = element(html, "article", "gz-credit-spread");
  assert.match(text(gzCard), /Status: Normal/);
  assert.match(text(gzCard), /Stale/);

  const summary = text(element(html, "section", "summary"));
  assert.match(summary, /1 normal 2 watch 0 alert 0 no threshold set/);
  assert.match(summary, /Last successful refresh: Oct 18, 2026, 11:17 UTC/);
  assert.match(summary, /Fetch failed: 10-year Treasury yield/);
  assert.match(summary, /Stale: Corporate credit spread/);
  assert.match(element(html, "section", "summary"), /<a href="#treasury-10y">/);
  assert.match(element(html, "section", "summary"), /<time datetime="2026-10-18T11:17:04Z">/);
});

test("renderPage's summary says so when nothing failed or is stale", () => {
  const summary = text(element(page(), "section", "summary"));

  assert.match(summary, /1 normal 2 watch 0 alert 0 no threshold set/);
  assert.doesNotMatch(summary, /Fetch failed:|Stale:/);
  assert.match(summary, /All indicators updated on schedule/);
});

test("renderPage shows each card's description, change, trend, thresholds, notes, and source", () => {
  const html = page();

  const capexCard = element(html, "article", "hyperscaler-capex-ratio");
  const capexText = text(capexCard);
  for (const config of indicators) {
    const card = text(element(html, "article", config.id));
    assert.ok(card.includes(config.description), `${config.id} description`);
    assert.ok(card.includes(config.thresholds!.rationale), `${config.id} rationale`);
    for (const note of config.notes ?? []) assert.ok(card.includes(note), `${config.id} note: ${note}`);
    assert.match(element(html, "article", config.id), new RegExp(`<footer>[\\s\\S]*<a href="${config.source.url.replaceAll("?", "\\?")}">`));
  }

  // 81.8104 − 60.8, four quarterly points back.
  assert.match(capexText, /\+21\.0 pp since Q2 2025/);
  assert.match(capexText, /Watch at 75\.0% or above\. Alert at 100\.0% or above\./);
  assert.match(capexText, /Capex \$566\.4B/);
  assert.match(capexText, /Operating cash flow \$692\.3B/);

  // Per-company breakdown, with each company's own fiscal period.
  const table = capexCard.match(/<table>[\s\S]*<\/table>/)![0];
  assert.match(table, /<caption>/);
  assert.match(text(table), /Company Period Capex Operating cash flow Capex ÷ cash flow/);
  assert.match(text(table), /ORCL Jun 2025 – May 2026 \$55\.7B \$32\.0B 174\.1%/);
  assert.match(table, /<th scope="row">ORCL<\/th>/);

  // Treasury: 5.09 − 4.55 against Jul 17, the newest point 90+ days back.
  const treasuryCard = element(html, "article", "treasury-10y");
  assert.match(text(treasuryCard), /\+0\.54 pp since Jul 17, 2026/);
  assert.match(treasuryCard, /<svg [^>]*role="img"[^>]*aria-label="Trend from Jul 17, 2026 to Oct 16, 2026: low 4\.55%, high 5\.10%\."/);

  // GZ: the required attribution, the EBP, and its overlay line. Three
  // monthly points can't show a three-month change.
  const gzCard = element(html, "article", "gz-credit-spread");
  // The required attribution replaces the "Source: name." line, as the link's text.
  assert.match(gzCard, /<a href="[^"]+">Source: Federal Reserve Board\.<\/a>/);
  assert.equal(text(gzCard).match(/Federal Reserve Board\./g)?.length, 1);
  assert.match(text(gzCard), /Excess bond premium −0\.39%/);
  assert.equal(gzCard.match(/<path /g)?.length, 2);
  assert.match(text(gzCard), /Not enough history yet for a change over 3 months\./);
});

test("renderPage escapes every config and data string it inserts", () => {
  const evil = `<script>x</script>"'&`;
  const escaped = "&lt;script&gt;x&lt;/script&gt;&quot;&#39;&amp;";
  const base = indicators.find((i) => i.id === "hyperscaler-capex-ratio")!;
  const hostile = {
    ...base,
    name: `Name ${evil}`,
    description: `Description ${evil}`,
    metric: `Metric ${evil}`,
    notes: [`Note ${evil}`],
    license: `License ${evil}`,
    source: { ...base.source, name: `Source ${evil}`, url: `https://example.test/?a=1&b="><script>`, attribution: `Attribution ${evil}` },
    thresholds: { ...base.thresholds!, rationale: `Rationale ${evil}` },
    fields: { capex: { label: `Label ${evil}`, units: "USD", decimals: 1 } },
  };
  const hostileData = {
    ...capex,
    points: capex.points.map((p) => ({
      ...p,
      ...(p.breakdown ? { breakdown: p.breakdown.map((r) => ({ ...r, label: `Co ${evil}` })) } : {}),
    })),
  };

  const html = page({ [capex.id]: hostileData }, [hostile]);

  assert.doesNotMatch(html, /<script>/);
  for (const field of ["Name", "Description", "Metric", "Note", "License", "Attribution", "Rationale", "Label", "Co"]) {
    assert.ok(html.includes(`${field} ${escaped}`), field);
  }
  assert.ok(html.includes(`href="https://example.test/?a=1&amp;b=&quot;&gt;&lt;script&gt;"`));

  // The source name shows only when there's no attribution to replace it.
  const { attribution: _, ...withoutAttribution } = hostile.source;
  const nameHtml = page({ [capex.id]: hostileData }, [{ ...hostile, source: withoutAttribution }]);
  assert.doesNotMatch(nameHtml, /<script>/);
  assert.ok(nameHtml.includes(`Source ${escaped}`));
});

test("renderPage shows a card with no data yet as such, with its source, and flags it", () => {
  const html = page({ [treasury.id]: treasury, [gz.id]: gz }); // no capex file yet

  const card = element(html, "article", "hyperscaler-capex-ratio");
  assert.match(card, /data-status="no-data"/);
  assert.match(text(card), /No data yet/);
  assert.match(text(card), /Stale/);
  assert.match(card, /Source: <a href="[^"]+">SEC EDGAR \(company filings\)<\/a>/);
  assert.doesNotMatch(card, /<svg|<table|since/);
  assert.match(text(element(html, "section", "summary")), /1 normal 1 watch 0 alert 0 no threshold set/);
});

test("renderPage ends with a disclaimer that the page is informational only", () => {
  const footer = page().match(/<\/main>\s*<footer>([\s\S]*?)<\/footer>/)![1]!;

  assert.match(text(footer), /informational only/i);
  assert.match(text(footer), /not investment advice/i);
});
