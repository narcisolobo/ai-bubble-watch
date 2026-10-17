# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript on Node (current LTS) for the whole pipeline. A build script writes a static `dist/index.html` with CSS inline and sparklines as inline SVG. No static site generator, no framework. Client-side JavaScript is at most a few lines. Hosted on GitHub Pages (or Cloudflare Pages), free tier, built and deployed by a daily GitHub Actions workflow. Source of truth: [docs/spec.md](docs/spec.md).

## Users

- **Owner (primary):** checks the page a few times a week to see whether any AI-overheating indicator has crossed a threshold. Wants a fast, trustworthy scan.
- **Shared-link viewers (secondary):** curious generalists, smart but not finance people. They don't know what a GZ spread or a capex-to-cash-flow ratio is, so every term needs a plain-English explanation. No accounts or login.

## Product Purpose

A one-page dashboard that tracks a few public indicators associated with AI-sector overheating and shows whether any have crossed owner-set thresholds. It reports data and nothing more: no predictions, no probabilities, no investment advice.

Success is two things at once. The owner trusts it as a personal check. And it holds up when a skeptical stranger arrives, because the sourcing, method, and threshold reasoning are visible enough that someone could cite it.

## Positioning

Transparency is the mechanism. Every value shows its source, as-of date or period, and the reasoning behind its thresholds. Gaps are shown rather than hidden: scenarios with no indicator are listed on the page. There is no composite "bubble score". If one is ever added, its formula must appear on the page. Only sources whose terms permit public display are used, and the licensing basis is recorded.

## Operating Context

- Viewed occasionally, often on a phone, in light or dark mode (follows system).
- Data refreshes once a day via a scheduled workflow. Indicators update at different cadences (daily, monthly, quarterly), so as-of dates vary per card.
- Shared as a link. Visitors arrive cold, with no onboarding.

## Capabilities and Constraints

- **v1 indicators:** hyperscaler capex as % of operating cash flow (SEC EDGAR, quarterly), 10-year Treasury yield (U.S. Treasury, daily), corporate credit spread / GZ spread with EBP as a secondary line (Federal Reserve Board, monthly).
- **Per card:** name, one-sentence plain-English description, current value with units, as-of date or period, change over the comparison period, sparkline, status, stale and fetch-failed flags, source link and required attribution, threshold rationale.
- **Status vocabulary:** normal, watch, alert, no threshold set. Separate flags: stale, fetch failed.
- **Summary bar:** counts per status, last successful refresh time, any failed or stale indicators.
- **Scenario mapping:** cards grouped by risk scenario; scenarios without an indicator are listed.
- **Required card caveats:** Oracle's operating cash flow includes large customer prepayments; cash capex excludes finance leases; companies' fiscal periods differ and are labeled.
- **Non-goals:** predictions, investment advice, accounts, notifications, paid data sources (unless the owner opts in), mobile app.
- **Undecided:** which model API prices to track in v2; whether to seek permission for "later" indicators (VIX, HY OAS, AI stock basket, GPU rental prices); threshold review after a couple of months of live data.

## Brand Commitments

- **Name:** AI Bubble Watch.
- **Voice:** plain, a little dry. Neutral and exact on the data; a slightly wry edge is allowed in framing copy. Never alarmist, never hype, never predictive.
- **Required text:** a footer disclaimer stating the page is informational only; "Federal Reserve Board" cited as the source for the credit spread.

## Evidence on Hand

- Real data from public sources (SEC, U.S. Treasury, Federal Reserve Board), with research and licensing notes in [docs/research/data-sources.md](docs/research/data-sources.md).
- Threshold values and their historical rationale in [docs/spec.md](docs/spec.md).
- No logo, testimonials, press, or user counts exist. Don't invent any.

## Product Principles

1. **Show the work.** Every number carries its source, date, and the reasoning behind its thresholds. A viewer should never have to trust the page on faith.
2. **Report, don't predict.** State what crossed which line. Leave conclusions to the reader.
3. **Explain for a newcomer, without slowing the owner.** Plain-English context is always available, but the at-a-glance status scan stays fast.
4. **Make gaps visible.** Missing coverage, stale data, and failed fetches are shown, not smoothed over.
5. **Calm by default.** An alert is information, not an alarm. The tone stays level even when indicators are red.

## Accessibility & Inclusion

- Status, stale, and fetch-failed states must not rely on color alone; use text labels or icons.
- Usable at phone width and in both light and dark mode.
- Fast to load: static HTML, inline CSS and SVG, minimal JavaScript.
