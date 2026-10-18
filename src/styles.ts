// The page's one stylesheet, inlined into <head> by renderPage. The "River
// Gauge" direction: each reading against stage bands for watch and alert.
// Styling goes through the markup's data-* hooks; see
// .impeccable/surfaces/src-render-ts.md.
//
// Stage positions come from --watch, --alert and --latest (percentages from
// the bottom), set on each chart and gauge staff by render.ts. The staff and
// the chart's dot assume higher-is-worse, as every v1 indicator is; the
// chart's bands are drawn in the SVG and handle either direction.

export const pageCss = `
:root {
  color-scheme: light dark;
  --ground: #ffffff;
  --ink: #20262e;
  --muted: #59626e;
  --rule: #d8dde3;
  --line: #1f5fa8;
  --normal-tint: #eef3f8;
  --watch-tint: #f7ecbf;
  --alert-tint: #eab8b2;
  --watch-edge: #a8841f;
  --alert-edge: #b4544a;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ground: #111418;
    --ink: #e7eaee;
    --muted: #a0a9b5;
    --rule: #2b323b;
    --line: #74b0f0;
    --normal-tint: #16202b;
    --watch-tint: #443a16;
    --alert-tint: #57292c;
    --watch-edge: #c9a640;
    --alert-edge: #d9776c;
  }
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0 auto;
  max-width: 46rem;
  padding: 0 16px 48px;
  background: var(--ground);
  color: var(--ink);
  font: 400 1rem/1.5 var(--font);
  font-variant-numeric: tabular-nums;
}
::selection { background: var(--watch-tint); color: var(--ink); }
/* Hydrograph blue is for data only; links are ink with an underline. */
a { color: var(--ink); text-decoration-color: var(--muted); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
a:hover { text-decoration-color: currentColor; text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 2px; }
h1, h2, h3 { line-height: 1.2; text-wrap: balance; margin: 0; }
p { margin: 0; }

/* ---- Header and summary ---------------------------------------------- */

body > header { padding: 24px 0 8px; }
h1 { font-size: 1.5rem; font-weight: 750; letter-spacing: -0.01em; }
#summary-heading {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
#summary > ul {
  display: flex; flex-wrap: wrap; gap: 4px 16px;
  margin: 8px 0 4px; padding: 0; list-style: none;
  font-size: 0.875rem; color: var(--muted);
}
#summary > ul data { font-weight: 700; color: var(--ink); }
#summary > p { font-size: 0.875rem; color: var(--muted); }
/* A failure or stale list links to its cards; an all-clear line has no links. */
#summary > p:has(a) {
  margin-top: 8px; padding: 8px 12px;
  background: var(--alert-tint); color: var(--ink); border-radius: 4px;
}

/* ---- Gauge board ------------------------------------------------------ */

#gauges { margin: 20px 0 0; padding: 16px 0 12px; border-block: 1px solid var(--rule); }
#gauges ul {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;
  margin: 0; padding: 0; list-style: none;
}
/* Phone: staff on top with its tick numerals to its left, words below. */
#gauges a { display: grid; grid-template-columns: minmax(0, 1fr); color: inherit; text-decoration: none; }
#gauges a > span:not([data-staff]) {
  grid-row: 4; margin-top: 4px;
  font-size: 0.75rem; line-height: 1.35; color: var(--muted);
}
#gauges a:hover > span:not([data-staff]) { color: var(--ink); text-decoration: underline; text-underline-offset: 0.18em; }
#gauges data { grid-row: 2; margin-top: 6px; font-size: 1.375rem; font-weight: 700; line-height: 1.1; }
#gauges strong { grid-row: 3; font-size: 0.8125rem; font-weight: 650; }
#gauges figcaption { margin-top: 12px; font-size: 0.75rem; color: var(--muted); }

[data-staff] {
  grid-row: 1; justify-self: start;
  position: relative; width: 14px; height: 64px; margin-left: 40px;
  border: 1px solid var(--ink);
  background: linear-gradient(to top,
    var(--normal-tint) 0 var(--watch),
    var(--watch-edge) var(--watch) calc(var(--watch) + 1px),
    var(--watch-tint) calc(var(--watch) + 1px) var(--alert),
    var(--alert-edge) var(--alert) calc(var(--alert) + 1px),
    var(--alert-tint) calc(var(--alert) + 1px) 100%);
}
/* The level marker: a bar across the staff at the latest reading. */
[data-staff]::after {
  content: ""; position: absolute; left: -5px; right: -5px;
  bottom: calc(var(--latest) - 2px); height: 4px;
  background: var(--line); border-radius: 1px;
  box-shadow: 0 0 0 1.5px var(--ground);
}
/* Graduations: the watch and alert values, with a tick to the staff. */
[data-tick] {
  position: absolute; right: calc(100% + 4px); transform: translateY(50%);
  display: flex; align-items: center; gap: 2px;
  font-size: 0.6875rem; font-weight: 600; line-height: 1; white-space: nowrap; color: var(--ink);
}
[data-tick]::after { content: ""; width: 4px; height: 1px; background: currentColor; }
[data-tick="watch"] { bottom: var(--watch); }
[data-tick="alert"] { bottom: var(--alert); }

/* ---- Scenario sections and cards -------------------------------------- */

main > section { padding-top: 32px; }
main > section > h2 { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.01em; padding-bottom: 4px; }
main > section > p { margin-top: 16px; font-size: 0.875rem; color: var(--muted); }

article { padding: 20px 0 28px; border-bottom: 1px solid var(--rule); }
article > h3 { font-size: 1.125rem; font-weight: 650; }
article > h3 + p { margin-top: 4px; max-width: 62ch; color: var(--muted); }
article > p { font-size: 0.875rem; color: var(--muted); }

[data-reading] {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px;
  margin-top: 16px;
}
[data-reading] data { font-size: 3rem; font-weight: 750; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }

/* "Status: Watch": the stage as a chip, with a three-segment staff marking its stage. */
article > p:has(> strong) { margin-top: 10px; }
article > p:has(> strong) + p { margin-top: 8px; }
article > p > strong {
  display: inline-flex; align-items: center; gap: 7px;
  margin-left: 4px; padding: 3px 10px 3px 8px;
  border: 1px solid var(--rule); border-radius: 4px;
  font-size: 0.875rem; font-weight: 650; color: var(--ink);
  --s-off: color-mix(in srgb, var(--ink) 35%, transparent);
  --s1: var(--s-off); --s2: var(--s-off); --s3: var(--s-off);
}
article > p > strong::before {
  content: ""; width: 6px; height: 16px;
  background: linear-gradient(to top,
    var(--s1) 0 4px, transparent 4px 6px,
    var(--s2) 6px 10px, transparent 10px 12px,
    var(--s3) 12px 16px);
}
[data-status="normal"] > p > strong { background: var(--normal-tint); --s1: var(--ink); }
[data-status="watch"] > p > strong { background: var(--watch-tint); border-color: var(--watch-edge); --s2: var(--ink); }
[data-status="alert"] > p > strong { background: var(--alert-tint); border-color: var(--alert-edge); --s3: var(--ink); }
[data-status="no-threshold"] > p > strong,
[data-status="no-data"] > p > strong { border-style: dashed; }

/* Stale and fetch-failed flags, in words. */
article > ul { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
article > ul > li {
  padding: 2px 10px; border: 1px dashed var(--alert-edge); border-radius: 4px;
  font-size: 0.8125rem; font-weight: 650;
}

/* ---- Charts ------------------------------------------------------------ */

[data-chart] {
  position: relative; height: 152px;
  margin: 20px 0 28px;
  background: var(--normal-tint);
  border-bottom: 1px solid var(--muted);
}
[data-chart] svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
[data-stage="watch"] { fill: var(--watch-tint); }
[data-stage="alert"] { fill: var(--alert-tint); }
[data-chart] path { fill: none; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
[data-series="value"] { stroke: var(--line); stroke-width: 2.25px; }
[data-series="ebp"] { stroke: var(--muted); stroke-width: 1.25px; stroke-dasharray: 4 3; }
/* Threshold lines across the plot, at the stage edges. */
[data-chart][style]::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(to top, transparent calc(var(--watch) - 0.5px), var(--watch-edge) calc(var(--watch) - 0.5px) calc(var(--watch) + 0.5px), transparent calc(var(--watch) + 0.5px)),
    linear-gradient(to top, transparent calc(var(--alert) - 0.5px), var(--alert-edge) calc(var(--alert) - 0.5px) calc(var(--alert) + 0.5px), transparent calc(var(--alert) + 0.5px));
}
/* The latest reading, at the line's right end. */
[data-chart][style]::after {
  content: ""; position: absolute; right: -5px; bottom: calc(var(--latest) - 5px);
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--line); box-shadow: 0 0 0 2px var(--ground);
}
/* Backed in their band's tint, so the line passes behind them. */
[data-level] {
  position: absolute; left: 6px; transform: translateY(-3px);
  padding: 2px 5px; border-radius: 2px;
  font-size: 0.75rem; font-weight: 650; line-height: 1;
}
[data-level="watch"] { bottom: var(--watch); background: var(--watch-tint); }
[data-level="alert"] { bottom: var(--alert); background: var(--alert-tint); }
/* The latest value, just above its dot. */
[data-latest] {
  position: absolute; right: 0; bottom: calc(var(--latest) + 9px);
  padding: 2px 5px; border-radius: 2px;
  background: var(--ground); box-shadow: 0 0 0 1px var(--rule);
  font-size: 0.75rem; font-weight: 700; line-height: 1;
}
[data-axis], [data-legend] { position: absolute; top: calc(100% + 6px); font-size: 0.75rem; color: var(--muted); }
[data-axis="start"] { left: 0; }
[data-axis="end"] { right: 0; }
[data-legend] { left: 50%; transform: translateX(-50%); white-space: nowrap; }
[data-chart]:has([data-legend]) { margin-bottom: 32px; }

/* ---- The method, one tap away -------------------------------------------- */

details { margin-top: 4px; font-size: 0.875rem; }
summary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 0; cursor: pointer; list-style: none;
  font-weight: 650; color: var(--ink);
}
summary:hover { text-decoration: underline; text-underline-offset: 0.18em; }
summary::-webkit-details-marker { display: none; }
summary::before {
  content: ""; width: 6px; height: 6px;
  border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
  transform: rotate(-45deg); transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
details[open] > summary::before { transform: rotate(45deg); }
details[open] > summary { margin-bottom: 8px; }
details > * + * { margin-top: 12px; }
details dl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; margin-block: 12px 0; }
details dt { font-weight: 650; }
details dt:not(:first-child) { margin-top: 8px; }
details dd { margin: 0; color: var(--muted); max-width: 62ch; }
@media (min-width: 40rem) {
  details dl { grid-template-columns: 11rem minmax(0, 1fr); column-gap: 16px; row-gap: 8px; }
  details dt:not(:first-child) { margin-top: 0; }
}
details ul { margin-block: 12px 0; padding-left: 1.1em; color: var(--muted); }
details li + li { margin-top: 4px; }
details > p { color: var(--muted); }

table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
caption { text-align: left; padding-bottom: 6px; font-weight: 650; }
th, td { padding: 6px 8px 6px 0; text-align: right; vertical-align: top; border-bottom: 1px solid var(--rule); }
th:first-child, thead th:nth-child(2), td:nth-child(2) { text-align: left; }
thead th { font-weight: 650; color: var(--muted); border-bottom-color: var(--muted); }
tbody th { font-weight: 650; }
td:not(:nth-child(2)) { white-space: nowrap; }
/* Wide enough for "Jul 2025 –", so a period breaks onto two lines at most. */
td:nth-child(2) { min-width: 5.4em; }

article > footer { margin-top: 8px; font-size: 0.8125rem; color: var(--muted); }

/* ---- Gaps and disclaimer ---------------------------------------------- */

#uncovered ul { display: grid; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
#uncovered li { padding: 10px 12px; border: 1px dashed var(--muted); border-radius: 4px; color: var(--muted); }

body > footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--rule); font-size: 0.8125rem; color: var(--muted); }

@media (min-width: 40rem) {
  body { padding-inline: 24px; }
  h1 { font-size: 1.75rem; }
  /* Desktop: staff on the left at full height, words beside it. */
  #gauges a { grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto 1fr; column-gap: 12px; align-items: end; }
  [data-staff] { grid-row: 1 / -1; width: 18px; height: 160px; margin-left: 44px; }
  #gauges data { grid-column: 2; grid-row: 1; margin-top: 0; font-size: 1.75rem; }
  main > section { padding-top: 40px; }
  #gauges strong { grid-column: 2; grid-row: 2; }
  #gauges a > span:not([data-staff]) { grid-column: 2; grid-row: 3; align-self: start; }
  [data-chart] { height: 184px; }
}
@media (prefers-reduced-motion: reduce) {
  summary::before { transition: none; }
}
`;
