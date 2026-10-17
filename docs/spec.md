# AI Bubble Watch: App Specification

## Purpose

A small web dashboard that tracks a handful of public indicators associated with AI-sector overheating and shows, at a glance, whether any of them have crossed thresholds the owner defines.

The app reports data. It does not predict a crash or assign probabilities. Each indicator is shown with its current value, its recent trend, its source, and the date the data is from, so the viewer can draw their own conclusions.

## Users

- **Primary:** the owner, checking it occasionally (a few times a week).
- **Secondary:** anyone the owner shares the link with. No accounts or login.

Because the page is public, every data source must permit public display (see [Data licensing](#data-licensing)).

## Core Features

### 1. Indicator cards

One card per indicator, each showing:

- Name and a one-sentence plain-English description of why it matters
- Current value with units, and the **as-of date or reporting period** of that value (e.g. "Oct 15, 2026" or "Q2 2026")
- Change over the indicator's comparison period (configured per indicator: e.g. 30/90 days for daily series, QoQ/YoY for quarterly ones)
- A small trend chart (inline SVG sparkline)
- Status, based on the indicator's thresholds: **normal**, **watch**, **alert**, or **no threshold set**
- A **stale** flag when the as-of date is older than the indicator's `maxAgeDays`, and a separate **fetch failed** flag when the last refresh attempt failed
- Source name with a link, and any attribution text the source requires

### 2. Summary bar

At the top of the page:

- Count of indicators in each status (e.g. "2 normal · 1 watch · 0 alert · 1 no threshold")
- Time of the most recent successful refresh run
- Any indicators that failed to update or are stale

No single composite "bubble score" in v1. If one is added later, its formula must be shown on the page.

### 3. Scenario mapping

Each indicator is tagged with the risk scenario(s) it relates to. The page groups cards by scenario and **lists scenarios that have no indicator yet**, so gaps in coverage are visible rather than hidden.

| Scenario                         | v1 indicator                                  | Later (needs a source or permission)       |
| -------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Revenue not catching up to capex | Hyperscaler capex; capex as % of operating cash flow | AI revenue (not consistently reported)     |
| Debt-funded buildout stress      | Corporate credit spread (GZ spread / EBP)     | HY OAS, data-center debt issuance          |
| GPU oversupply / depreciation    | —                                             | GPU rental price index                     |
| Valuation pressure               | —                                             | AI stock basket vs. broad index            |
| Macro shock                      | 10-year Treasury yield; credit spread         | VIX                                        |
| Commoditization / price wars     | —                                             | Model API list prices (v2, manual entry)   |

### 4. Configuration

Indicators and scenarios live in one config file, [config/indicators.ts](../config/indicators.ts), not in code. It's a typed TypeScript object, so the type checker catches a misspelled field or scenario. The types, with a comment on every field, are in [src/schema.ts](../src/schema.ts). For each indicator:

- `id` (also the data file name), `name`, `description`
- `scenarios` (list of scenario ids)
- `source`: name, URL for the card link, `fetcher`, and `attribution` text if required
- `license`: a short note on why public display is allowed (e.g. "US government work, public domain")
- `metric`: what the displayed value and thresholds apply to, when it differs from the raw series (e.g. "capex ÷ operating cash flow")
- `units` and `decimals`; thresholds use the same units as the value
- `frequency` (daily, monthly, quarterly) and `changePeriod` (`{ days }` or `{ points }`)
- `maxAgeDays`: how old the latest point can be before the card is flagged stale
- `notes`: caveats shown on the card
- `thresholds`: `watch` and `alert` values, `direction` (higher-is-worse or lower-is-worse), and a one-sentence `rationale` shown on the card. Optional; if absent, status is "no threshold set". A value at the threshold counts as crossing it.

Adding or removing an indicator should mean editing config plus, at most, writing one fetcher.

In v2, a `manual` fetcher will read values the owner enters by hand in a data file, each with a date and source link. It will cover useful series that have no API, starting with model API list prices.

## Data

### Data licensing

- Use a source only if its terms permit display on a public web page, or the owner has written permission from the data owner. Record the basis in `license`.
- No paid sources unless the owner explicitly opts in.
- Research on candidate sources (2026-10-16) is in [research/data-sources.md](research/data-sources.md). In short: SEC, Treasury, and Federal Reserve Board data are public; every free stock-price API, the ICE high-yield spread, VIX, and every GPU rental index checked restrict public display.
- v1 does not use FRED. Its API terms prohibit storing, caching, or archiving FRED content, and the series of interest that aren't public domain carry third-party copyrights.

### v1 indicators

All three need no API key.

**1. Hyperscaler capex** (quarterly, USD)
- Source: SEC EDGAR XBRL API, `https://data.sec.gov/api/xbrl/companyconcept/CIK{10-digit}/us-gaap/{Concept}.json`
- Companies and concepts:
  - MSFT, GOOGL, META, ORCL: `PaymentsToAcquirePropertyPlantAndEquipment`
  - AMZN: `PaymentsToAcquireProductiveAssets`
- Displayed value: capex as a percentage of operating cash flow, as a proxy for "is spending outrunning what the business generates." The combined capex and cash flow dollar totals and a per-company breakdown are shown for context. All five companies use `NetCashProvidedByUsedInOperatingActivities`, with the same YTD rules as capex.
- One point per calendar quarter end, using each company's latest fiscal quarter ending on or before it. A point appears once all five companies have filed for that quarter. Oracle's operating cash flow includes large customer prepayments for capex ($11.4B of $23.1B in Q1 FY27), which make its ratio look healthier. Note this on the card.
- Rules:
  - Send a `User-Agent` header with contact info (requests without one get HTTP 403). Stay under 10 requests per second.
  - Identify periods by `start`/`end` dates only. The `fy`/`fp` fields describe the filing, not the period. Don't use the frames API.
  - Most 10-Q cash-flow values are year-to-date, so derive each quarter by differencing consecutive YTD values within a fiscal year. Q4 = 10-K full year − 9-month YTD.
  - Fiscal years differ (MSFT ends June, ORCL ends May), so label each company's period on the card.
  - Note on the card that cash capex excludes finance leases, which are large for some companies. For example, Microsoft reported $329.1B of signed datacenter leases not yet commenced.
- Thresholds apply to the **ratio**: the five companies' combined trailing-four-quarter capex ÷ combined trailing-four-quarter operating cash flow, higher-is-worse.
  - **Watch ≥ 75%.** From 2018 through 2024 the ratio ranged from 36% to 55%. 75% means three quarters of operating cash goes into capex.
  - **Alert ≥ 100%.** The group is spending more than it generates from operations, so the difference has to come from debt, cash reserves, or other financing.
  - The capex dollar total has no threshold. It's shown for context, and the ratio carries the status.
  - Per-company ratios are shown without status. As of mid-2026: ORCL 161%, AMZN 107%, GOOGL 71%, META 69%, MSFT 63%.

**2. 10-year Treasury yield** (daily, %)
- Source: US Treasury daily yield curve CSV, column "10 Yr": `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{YYYY}/all?type=daily_treasury_yield_curve&field_tdr_date_value={YYYY}&page&_format=csv`
- No data on weekends or federal holidays, so set `maxAgeDays` to allow for that.
- Thresholds on the yield level, higher-is-worse, because higher rates raise borrowing costs for the buildout and pressure valuations.
  - **Watch ≥ 5.0%:** about the 90th percentile of daily values since 2000.
  - **Alert ≥ 5.5%:** above the 95th percentile since 2000. The yield hasn't reached 5.5% since May 2001. Its highest close since 2008 was 5.31%, on 2026-10-05.

**3. Corporate credit spread** (monthly, %)
- Source: Federal Reserve Board, GZ spread and excess bond premium: `https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv` (columns `gz_spread`, `ebp`)
- Updated after 10:00 a.m. on the fourth business day of each month. The whole history can be revised, so replace the stored history on each fetch.
- Cite "Federal Reserve Board" as the source.
- Thresholds on the GZ spread, higher-is-worse. The EBP is shown as a secondary line without status, because it's a model estimate that's harder to explain in one sentence.
  - **Watch ≥ 2.0%:** about the 75th percentile since 1973. The 2022 rate shock peaked just under this (1.94%), so it takes more than a rate scare to trigger it.
  - **Alert ≥ 3.0%:** about the 92nd percentile. Every recent credit stress episode passed it: dot-com bust 4.35%, 2008 7.84%, 2020 3.82%.

### Later, with owner opt-in or permission

- **AI stock basket vs. broad index.** No free source permits public display. Options: written non-commercial permission from Alpha Vantage, or a paid redistribution tier.
- **VIX.** Cboe copyright. Needs permission.
- **High-yield OAS (ICE BofA).** Reproduction is prohibited without ICE permission.
- **GPU rental prices.** Ornn, Silicon Data, and vast.ai all forbid republication. Azure's Retail Prices API is public and keyless, but its reuse terms are unconfirmed, and list prices rarely change (the on-demand H100 price hasn't changed since 2023-12-01), so it tracks oversupply poorly.

### Storage

- File-based, committed to the repo: one JSON file per indicator at `data/{id}.json`. Git history doubles as an audit trail. Types are `IndicatorData` and `Point` in [src/schema.ts](../src/schema.ts).
- Each point records `date`, `value`, `sourceUrl`, and `fetchedAt`, plus optional `periodStart`, `secondary` series (e.g. EBP), and `breakdown` rows (e.g. per company). A period value is dated by its period's end, so September's GZ spread is `2026-09-30` with `periodStart` `2026-09-01`.
- Each fetcher returns points and a write mode. `merge` upserts by `date`, so a newer value for the same date replaces the old one, which handles revisions. `replace` swaps in the whole history, for sources that revise all of it (the GZ spread).
- Each file also records `lastSuccessAt` and `lastAttempt` (time, ok, error). A failed fetch updates only `lastAttempt`, so the last good points stay visible and the summary bar can list the failure.

Example, abbreviated:

```json
{
  "id": "gz-credit-spread",
  "points": [
    {
      "date": "2026-09-30",
      "periodStart": "2026-09-01",
      "value": 0.93,
      "secondary": { "ebp": -0.39 },
      "sourceUrl": "https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv",
      "fetchedAt": "2026-10-17T11:17:04Z"
    }
  ],
  "lastSuccessAt": "2026-10-17T11:17:04Z",
  "lastAttempt": { "at": "2026-10-17T11:17:04Z", "ok": true }
}
```

## Refresh

- A daily scheduled GitHub Actions workflow runs all fetchers, commits changed data, builds the page, and deploys it, **all in one workflow**. Pushes made with `GITHUB_TOKEN` don't trigger other workflows, so a separate on-push deploy workflow wouldn't run.
- Schedule it off the hour (e.g. `17 11 * * *` UTC). GitHub delays or drops scheduled runs under load, especially at the top of the hour.
- The same workflow can be started by hand (`workflow_dispatch`), and the same script runs locally, for manual refresh.
- One fetcher failing must not stop the others.
- **60-day rule:** GitHub disables scheduled workflows in public repos after 60 days without "repository activity". The docs don't say whether the workflow's own commits count. Plan for the owner to push a commit at least every 60 days, and to re-enable the workflow if it gets disabled (`gh workflow enable`). Don't use dummy-commit keepalive actions.

## Non-Goals (v1)

- No predictions, probabilities, or investment advice. Include a short footer disclaimer saying the page is informational only.
- No user accounts, alerts by email/push, or notifications.
- No paid data sources unless the owner explicitly opts in.
- No mobile app or native widget.

## Design

- Single page, clean and readable, works at phone width.
- Light and dark mode (follows system setting).
- Status colors must not be the only signal; include text labels or icons. The same applies to stale and failed flags.
- Fast to load. The page is generated at build time, with sparklines rendered as inline SVG. Client-side JavaScript is at most a few lines (e.g. for grouping).

## Stack

- **TypeScript on Node** (current LTS) for the whole pipeline: fetchers, status logic, and page build. It runs in GitHub Actions or locally, never in the browser. Browsers can't fetch the sources directly: SEC doesn't allow cross-origin requests and requires a `User-Agent` header, which pages can't set.
- Run `.ts` files directly with Node's built-in type stripping. `tsc --noEmit` does type checking in CI.
- No static site generator. A build script reads the config and `data/*.json` and writes `dist/index.html`, with CSS inline and sparklines as inline SVG. Every inserted value goes through one HTML-escape helper.
- Built-ins first: `fetch`, `node:test`, `node:fs`. Add dependencies only when they clearly pay for themselves.
- If v2 adds more pages, revisit using Eleventy or Astro.

## Hosting

- Static site on GitHub Pages (or Cloudflare Pages), built and deployed by the scheduled workflow above.
- Free tier only. No server, database, or API keys required for v1.

## Open Items

- **Threshold review:** the v1 thresholds above are based on history (checked 2026-10-16). Review them after a couple of months of live data.
- **Model API prices (v2):** decide which models and providers to track.
- **Opt-in sources:** decide whether to request permission for any of the "Later" indicators.

## Acceptance Criteria for v1

- [ ] The three v1 indicators display current values, as-of dates or periods, trends, sources, and required attribution.
- [ ] Indicators and thresholds are defined in config, not code.
- [ ] Status (normal / watch / alert / no threshold set) is computed correctly at and around threshold boundaries, for both directions. Covered by unit tests.
- [ ] Quarterly capex derived from YTD filings matches company-reported quarterly figures for at least one test case per company.
- [ ] Scheduled refresh runs daily, builds, and deploys without manual action.
- [ ] A failed fetch leaves the previous value visible, marked "fetch failed", and listed in the summary bar.
- [ ] Data older than `maxAgeDays` is marked stale.
- [ ] Scenarios without an indicator are listed on the page.
- [ ] Page is usable on a phone and in dark mode.
- [ ] Disclaimer footer is present.
