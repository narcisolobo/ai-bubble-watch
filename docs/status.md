# Project status

As of 2026-10-17, commit `1df04d4`. Update this file when you finish a step.

The spec is [docs/spec.md](spec.md). Design and copy guidance is in [PRODUCT.md](../PRODUCT.md). Source licensing and API research is in [docs/research/data-sources.md](research/data-sources.md).

## Done

| Piece | Code | Notes |
| --- | --- | --- |
| Config and data formats | `src/schema.ts`, `config/indicators.ts` | Three v1 indicators, thresholds with rationale, staleness limits |
| Store | `src/store.ts` | `applySuccess` (merge/replace), `applyFailure`, `readData`/`writeData`. Refuses empty results; never overwrites a corrupt file |
| Refresh loop | `src/run.ts`, `src/refresh.ts` | `npm run refresh`. One failing fetcher doesn't stop the others. Exits 0 on fetch failures so the page still deploys |
| SEC parsing | `src/fetchers/sec-capex.ts` | `fetchConcept`, `toQuarters`, `capexRatio`. **Not yet a `Fetcher`**; see step 2 |
| Treasury fetcher | `src/fetchers/treasury-yield.ts` | Registered and checked live (448 points) |

`src/fetchers/index.ts` still has `notBuilt` placeholders for `sec-capex` and `fed-gz-spread`. `run()` records each placeholder as a failed fetch.

## Next, in order

1. **Fed GZ spread fetcher** (`fed-gz-spread`)
   - Source: `https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv`, columns `date,gz_spread,ebp,est_prob`. Each date is the first of the month.
   - Each point: `date` = month end, `periodStart` = month start, `value` = `gz_spread`, `secondary: { ebp }`. Return `mode: "replace"`, because the Fed revises the whole history every month.
   - Done when it's registered in `src/fetchers/index.ts` and a live refresh into a scratch `DATA_DIR` writes a full history whose latest point matches the CSV's last row.
2. **SEC capex `Fetcher` wrapper** (`sec-capex`)
   - Fetch 10 concepts: 5 companies × (capex, operating cash flow). CIKs and concept names are in the spec and the research doc; Amazon's capex concept differs from the others.
   - Rebuild history: one point per calendar quarter end, made by running `capexRatio` on quarter lists cut off at that date. A point exists only once every company has a fiscal quarter ending within that calendar quarter. Oracle's May, Aug, Nov and Feb quarters fall in calendar Q2, Q3, Q4 and Q1.
   - `capexRatio` returns a fraction, but the config's units are `%`, so store `ratio × 100`. Put per-company rows in `breakdown`, and the combined dollar totals in `secondary`.
   - Done when it's registered, and a live refresh gives a latest combined ratio of about 82.9% (mid-2026) with points going back to at least 2018. The research doc lists the 2018–2024 range as 36–55%.
3. **Status logic**: a pure function from a config and data file to the card status (normal / watch / alert / no threshold set) plus the stale and fetch-failed flags, and the summary-bar counts.
   - Done when unit tests cover values exactly at, just below and just above each threshold, in both directions, and the boundaries of `maxAgeDays`.
4. **Page build**: `src/build.ts` writes `dist/index.html` with inline CSS and inline SVG sparklines, per the spec's Design and Stack sections and PRODUCT.md. Run every inserted value through one HTML-escape helper.
   - Done when it builds from the committed data, works at phone width and in dark mode, and every acceptance criterion in the spec that's about the page is met.
5. **Scheduled workflow**: `.github/workflows/refresh.yml`. A single job runs refresh, commits `data/`, builds, and deploys to GitHub Pages, all in one workflow. It runs on a cron off the hour (e.g. `17 11 * * *`) and also allows `workflow_dispatch`. It needs a `timeout-minutes` limit and an `SEC_USER_AGENT` repository secret. The spec's Refresh section explains why it's one job.
   - The owner creates the secret and enables Pages; ask them to do this. The remote is `github.com/narcisolobo/ai-bubble-watch`.

## Open decisions (the owner's call)

- **Lagging company flag.** For now, a gap in a company's quarters makes `capexRatio` throw, so the card shows "fetch failed". No separate flag marks a company whose newest 10-Q isn't out yet. Each company's `periodEnd` is exposed, and `maxAgeDays` covers staleness.
- **Optional hardening.** These were left out on purpose. Offer them; don't add them unasked.
  - `readData` checks only that the file is valid JSON, not its fields.
  - The Treasury parser doesn't check the date format.
- **Permission-gated indicators** (VIX, HY OAS, AI stock basket, GPU prices) and **v2 model API prices**: not started, and need the owner's decision.

## Gotchas learned the hard way

- **Treasury** returns HTTP 200 with an empty body for a year that has no rows yet. The parser treats that as zero rows.
- **Treasury's** "10 Yr" column moved when "1.5 Month" was added in 2025. Find columns by header name.
- **Treasury's** CSVs have no trailing newline, so `wc -l` undercounts their rows by one.
- **SEC** returns 403 without a `User-Agent`.
  - The `fy`/`fp` fields describe the filing, not the period. Identify periods by `start`/`end`.
  - The frames API is unreliable for these companies.
- **FRED** isn't used anywhere: its terms forbid storing its data, and the useful series are copyrighted. Get public-domain data from the original government source instead.
