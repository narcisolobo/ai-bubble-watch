// Builds the page model from config and data, and renders it as one HTML
// document. No CSS yet: the markup is semantic, with data-* hooks for styling.
// See docs/spec.md, "Core Features", "Design", and "Stack".

import type { IndicatorConfig, IndicatorData, Point, Scenario, Thresholds } from "./schema.ts";
import { pageCss } from "./styles.ts";
import { cardStatus, summarize, type CardStatus, type Status, type Summary } from "./status.ts";
import {
  change,
  formatChange,
  formatPeriod,
  formatRange,
  formatValue,
  scenarioGroups,
  sparkline,
  sparklineHeight,
  sparklineWidth,
  escapeHtml as e,
  type ScenarioGroup,
  type Sparkline,
} from "./view.ts";

export interface Card {
  config: IndicatorConfig;
  data: IndicatorData | null;
  status: CardStatus;
}

export interface PageModel {
  summary: Summary;
  /** Every card, in config order, for the gauge board. */
  cards: Card[];
  groups: (Omit<ScenarioGroup, "indicators"> & { cards: Card[] })[];
  uncovered: Scenario[];
  /** Names by indicator id, for the summary's lists. */
  names: Map<string, string>;
}

export function buildModel(input: {
  scenarios: Scenario[];
  indicators: IndicatorConfig[];
  /** By indicator id; null or missing when there's no data file yet. */
  data: Map<string, IndicatorData | null>;
  now: string;
}): PageModel {
  const { groups, uncovered } = scenarioGroups(input.scenarios, input.indicators);
  const cards = new Map(
    input.indicators.map((config) => {
      const data = input.data.get(config.id) ?? null;
      return [config.id, { config, data, status: cardStatus(config, data, input.now) }];
    }),
  );
  return {
    // In config order, so the summary lists match the page.
    summary: summarize(
      [...cards.values()].map(({ config, data, status }) => ({
        id: config.id,
        lastSuccessAt: data?.lastSuccessAt ?? null,
        card: status,
      })),
    ),
    cards: [...cards.values()],
    groups: groups.map(({ indicators, ...group }) => ({ ...group, cards: indicators.map((i) => cards.get(i.id)!) })),
    uncovered,
    names: new Map(input.indicators.map((i) => [i.id, i.name])),
  };
}

const statusLabels: Record<Status, string> = {
  normal: "Normal",
  watch: "Watch",
  alert: "Alert",
  "no-threshold": "No threshold set",
};

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function renderPage(model: PageModel): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>AI Bubble Watch</title>
<style>${pageCss}</style>
</head>
<body>
<header>
<h1>AI Bubble Watch</h1>
${renderSummary(model)}
</header>
<main>
${model.groups.map(renderGroup).join("\n")}
<section id="uncovered" aria-labelledby="uncovered-heading">
<h2 id="uncovered-heading">Scenarios without an indicator yet</h2>
<ul>
${model.uncovered.map((s) => `<li>${e(s.name)}</li>`).join("\n")}
</ul>
</section>
</main>
<footer>
<p>This page is informational only. It reports public data, and it is not investment advice or a prediction.</p>
</footer>
</body>
</html>
`;
}

function renderBoard(cards: Card[]): string {
  const entries = cards.map(({ config, data, status }) => {
    const line = chart(config, data?.points ?? []);
    const t = config.thresholds;
    const ticks = t ? `<span data-tick="watch">${e(fmt(config, t.watch))}</span><span data-tick="alert">${e(fmt(config, t.alert))}</span>` : "";
    // The staff repeats the chart in miniature, so screen readers skip it.
    const staff = line?.levels ? `<span data-staff${levelStyle(line.levels)} aria-hidden="true">${ticks}</span> ` : "";
    const value = status.latest ? ` <data value="${status.latest.value}">${e(fmt(config, status.latest.value))}</data>` : "";
    const stage = status.status ? statusLabels[status.status] : "No data yet";
    return `<li data-status="${status.status ?? "no-data"}"><a href="#${e(config.id)}">${staff}<span>${e(config.name)}</span>${value} <strong>${stage}</strong></a></li>`;
  });
  return `<figure id="gauges">
<ul>
${entries.join("\n")}
</ul>
<figcaption>Scale matches the chart below.</figcaption>
</figure>`;
}

function renderSummary({ summary, names, cards }: PageModel): string {
  const counts = (Object.keys(statusLabels) as Status[])
    .map((status) => `<li><data value="${summary.counts[status]}">${summary.counts[status]}</data> ${e(statusLabels[status].toLowerCase())}</li>`)
    .join("\n");
  const links = (ids: string[]) => ids.map((id) => `<a href="#${e(id)}">${e(names.get(id) ?? id)}</a>`).join(", ");
  const problems = [
    summary.failed.length ? `<p>Fetch failed: ${links(summary.failed)}</p>` : "",
    summary.stale.length ? `<p>Stale: ${links(summary.stale)}</p>` : "",
  ].filter(Boolean);
  const refreshed = summary.lastSuccessAt
    ? `<time datetime="${e(summary.lastSuccessAt)}">${e(timestampFormat.format(new Date(summary.lastSuccessAt)))} UTC</time>`
    : "never";
  return `<section id="summary" aria-labelledby="summary-heading">
<h2 id="summary-heading">Summary</h2>
<ul>
${counts}
</ul>
<p>Last successful refresh: ${refreshed}</p>
${problems.length ? problems.join("\n") : "<p>All indicators updated on schedule.</p>"}
${renderBoard(cards)}
</section>`;
}

function renderGroup(group: PageModel["groups"][number]): string {
  const id = e(group.scenario.id);
  const also = group.alsoRelevant.length
    ? `<p>Also relevant: ${group.alsoRelevant
        .map(({ indicator, home }) => `<a href="#${e(indicator.id)}">${e(indicator.name)}</a> (under ${e(home.name)})`)
        .join("; ")}</p>\n`
    : "";
  return `<section id="${id}" aria-labelledby="${id}-heading">
<h2 id="${id}-heading">${e(group.scenario.name)}</h2>
${group.cards.map(renderCard).join("\n")}
${also}</section>`;
}

function renderCard({ config, data, status }: Card): string {
  const id = e(config.id);
  const { latest } = status;
  const points = data?.points ?? [];
  const flags = [status.stale ? "Stale" : "", status.fetchFailed ? "Fetch failed" : ""].filter(Boolean);
  const value = latest
    ? `<p data-reading><data value="${latest.value}">${e(fmt(config, latest.value))}</data> <span>as of ${time(config, latest.date)}</span></p>`
    : "<p>No data yet</p>";
  const parts = [
    `<p>${e(config.description)}</p>`,
    value,
    `<p>Status: <strong>${status.status ? statusLabels[status.status] : "No data yet"}</strong></p>`,
    flags.length ? `<ul>\n${flags.map((f) => `<li>${f}</li>`).join("\n")}\n</ul>` : "",
    latest ? renderChange(config, points) : "",
    renderSparkline(config, points),
    renderMethod(config, latest),
    renderSource(config),
  ];
  return `<article id="${id}" aria-labelledby="${id}-heading" data-status="${status.status ?? "no-data"}"${status.stale ? " data-stale" : ""}${status.fetchFailed ? " data-fetch-failed" : ""}>
<h3 id="${id}-heading">${e(config.name)}</h3>
${parts.filter(Boolean).join("\n")}
</article>`;
}

/** What a skeptic needs, one tap away: thresholds and why, totals, the per-company table, caveats, license. */
function renderMethod(config: IndicatorConfig, latest: Point | null): string {
  const parts = [
    renderDetails(config),
    latest ? renderSecondary(config, latest) : "",
    latest ? renderBreakdown(config, latest) : "",
    config.notes?.length ? `<ul>\n${config.notes.map((n) => `<li>${e(n)}</li>`).join("\n")}\n</ul>` : "",
    `<p>License: ${e(config.license)}</p>`,
  ];
  return `<details>
<summary>How this is measured</summary>
${parts.filter(Boolean).join("\n")}
</details>`;
}

function fmt(config: IndicatorConfig, value: number): string {
  return formatValue(value, config.units, config.decimals);
}

function time(config: IndicatorConfig, date: string): string {
  return `<time datetime="${e(date)}">${e(formatPeriod(date, config.frequency))}</time>`;
}

const pointUnits: Record<IndicatorConfig["frequency"], string> = { daily: "days", monthly: "months", quarterly: "quarters" };

function renderChange(config: IndicatorConfig, points: Point[]): string {
  const result = change(points, config.changePeriod);
  if (result) {
    return `<p>${e(formatChange(result.delta, config.units, config.decimals))} since ${time(config, result.from.date)}</p>`;
  }
  const period =
    "days" in config.changePeriod
      ? `${config.changePeriod.days} days`
      : `${config.changePeriod.points} ${pointUnits[config.frequency]}`;
  return `<p>Not enough history yet for a change over ${period}.</p>`;
}

/** A card's chart. The gauge board uses it too, so a staff and its chart share one scale. */
function chart(config: IndicatorConfig, points: Point[]): Sparkline | null {
  return sparkline(points, {
    ...(config.sparklineYears !== undefined ? { years: config.sparklineYears } : {}),
    ...(config.sparklineOverlay ? { overlay: config.sparklineOverlay } : {}),
    ...(config.thresholds ? { thresholds: config.thresholds } : {}),
  });
}

function renderSparkline(config: IndicatorConfig, points: Point[]): string {
  const t = config.thresholds;
  const line = chart(config, points);
  if (!line) return "";
  // Each stage runs from its level to the next one, or to the chart's edge on the worse side.
  const stages = t && line.levels ? [
    ["alert", line.levels.alert, t.direction === "higher-is-worse" ? 1 : 0],
    ["watch", line.levels.watch, line.levels.alert],
  ] as const : [];
  const rects = stages.map(
    ([stage, a, b]) =>
      `<rect data-stage="${stage}" x="0" y="${svgRound(sparklineHeight * (1 - Math.max(a, b)))}" width="${sparklineWidth}" height="${svgRound(sparklineHeight * Math.abs(a - b))}"/>\n`,
  );
  const overlayLabel = config.sparklineOverlay ? config.fields?.[config.sparklineOverlay]?.label : undefined;
  const label =
    `Trend from ${formatPeriod(line.first.date, config.frequency)} to ${formatPeriod(line.last.date, config.frequency)}: ` +
    `low ${fmt(config, line.low)}, high ${fmt(config, line.high)}.` +
    (overlayLabel ? ` Second line: ${overlayLabel.toLowerCase()}.` : "") +
    (t ? ` ${thresholdText(config, t)}` : "");
  const sign = t?.direction === "lower-is-worse" ? "≤" : "≥";
  const levelLabels = t
    ? `\n<span data-level="watch">Watch ${sign} ${e(fmt(config, t.watch))}</span>\n<span data-level="alert">Alert ${sign} ${e(fmt(config, t.alert))}</span>`
    : "";
  // Placed by --latest, so only a chart with levels can put it beside its dot.
  const latestLabel = line.levels ? `\n<span data-latest>${e(fmt(config, line.last.value))}</span>` : "";
  return `<figure data-chart${levelStyle(line.levels)}>
<svg viewBox="0 0 ${sparklineWidth} ${sparklineHeight}" preserveAspectRatio="none" role="img" aria-label="${e(label)}">
${rects.join("")}<path d="${line.main}" data-series="value"/>${line.overlay ? `\n<path d="${line.overlay}" data-series="${e(config.sparklineOverlay!)}"/>` : ""}
</svg>${levelLabels}${latestLabel}
<span data-axis="start">${e(formatPeriod(line.first.date, config.frequency))}</span>
<span data-axis="end">${e(formatPeriod(line.last.date, config.frequency))}</span>${overlayLabel ? `\n<span data-legend>Dashed line: ${e(overlayLabel.toLowerCase())}</span>` : ""}
</figure>`;
}

/** The levels as CSS properties, percentages from the bottom, for the chart's labels and dot and the gauge staff. */
function levelStyle(levels: Sparkline["levels"]): string {
  if (!levels) return "";
  const pct = (f: number) => `${(f * 100).toFixed(2)}%`;
  return ` style="--watch:${pct(levels.watch)};--alert:${pct(levels.alert)};--latest:${pct(levels.latest)}"`;
}

/** "Watch at 5.00% or above. Alert at 5.50% or above." Unescaped. */
function thresholdText(config: IndicatorConfig, t: Thresholds): string {
  const side = t.direction === "higher-is-worse" ? "or above" : "or below";
  return `Watch at ${fmt(config, t.watch)} ${side}. Alert at ${fmt(config, t.alert)} ${side}.`;
}

/** SVG coordinates to two decimals, as the sparkline paths are. */
function svgRound(n: number): number {
  return Number(n.toFixed(2));
}

function renderDetails(config: IndicatorConfig): string {
  const rows: [string, string][] = [];
  if (config.metric) rows.push(["Metric", e(config.metric)]);
  const t = config.thresholds;
  if (t) {
    rows.push(["Thresholds", e(thresholdText(config, t))]);
    rows.push(["Why these thresholds", e(t.rationale)]);
  } else {
    rows.push(["Thresholds", "None set."]);
  }
  return `<dl>\n${rows.map(([term, detail]) => `<dt>${term}</dt>\n<dd>${detail}</dd>`).join("\n")}\n</dl>`;
}

function renderSecondary(config: IndicatorConfig, latest: Point): string {
  const rows = Object.entries(config.fields ?? {}).filter(([key]) => latest.secondary?.[key] !== undefined);
  if (!rows.length) return "";
  return `<dl>\n${rows
    .map(([key, f]) => `<dt>${e(f.label)}</dt>\n<dd>${e(formatValue(latest.secondary![key]!, f.units, f.decimals))}</dd>`)
    .join("\n")}\n</dl>`;
}

function renderBreakdown(config: IndicatorConfig, latest: Point): string {
  const rows = latest.breakdown ?? [];
  if (!rows.length) return "";
  const columns = Object.entries(config.fields ?? {}).filter(([key]) => rows.some((r) => r.values[key] !== undefined));
  const cell = (value: number | undefined, f: { units: string; decimals: number }) =>
    `<td>${value === undefined ? "" : e(formatValue(value, f.units, f.decimals))}</td>`;
  return `<table>
<caption>By company, each over its latest four fiscal quarters</caption>
<thead>
<tr><th scope="col">Company</th><th scope="col">Period</th>${columns.map(([, f]) => `<th scope="col">${e(f.label)}</th>`).join("")}</tr>
</thead>
<tbody>
${rows
  .map(
    (r) =>
      `<tr><th scope="row">${e(r.label)}</th><td>${e(formatRange(r.periodStart, r.periodEnd))}</td>${columns.map(([key, f]) => cell(r.values[key], f)).join("")}</tr>`,
  )
  .join("\n")}
</tbody>
</table>`;
}

function renderSource(config: IndicatorConfig): string {
  const { source } = config;
  // A required attribution replaces the default line, so the source isn't named twice.
  const line = source.attribution
    ? `<a href="${e(source.url)}">${e(source.attribution)}</a>`
    : `Source: <a href="${e(source.url)}">${e(source.name)}</a>.`;
  return `<footer>
<p>${line}</p>
</footer>`;
}
