# Project status

As of 2026-10-18, through page styling. Update this file when you finish a step.

The spec is [docs/spec.md](spec.md). Design and copy guidance is in [PRODUCT.md](../PRODUCT.md). Source licensing and API research is in [docs/research/data-sources.md](research/data-sources.md).

## Done

| Piece                   | Code                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config and data formats | `src/schema.ts`, `config/indicators.ts`        | Three v1 indicators, thresholds with rationale, staleness limits                                                                                                                                                                                                                                                                                                                            |
| Store                   | `src/store.ts`                                 | `applySuccess` (merge/replace), `applyFailure`, `readData`/`writeData`. Refuses empty results; never overwrites a corrupt file                                                                                                                                                                                                                                                              |
| Refresh loop            | `src/run.ts`, `src/refresh.ts`                 | `npm run refresh`. One failing fetcher doesn't stop the others. Exits 0 on fetch failures so the page still deploys                                                                                                                                                                                                                                                                         |
| SEC capex fetcher       | `src/fetchers/sec-capex.ts`                    | `fetchConcept`, `toQuarters`, `capexRatio`, `capexHistory`, `secCapex`. Registered and checked live 2026-10-18 (33 points, 2018-06-30 to 2026-06-30, latest 81.8%). `mode: "replace"`                                                                                                                                                                                                       |
| Treasury fetcher        | `src/fetchers/treasury-yield.ts`               | Registered and checked live (448 points)                                                                                                                                                                                                                                                                                                                                                    |
| Fed GZ spread fetcher   | `src/fetchers/fed-gz-spread.ts`                | Registered and checked live 2026-10-18 (645 points, 1973-01 to 2026-09). `mode: "replace"`. Values are stored at full precision; `decimals` rounds for display                                                                                                                                                                                                                              |
| Status logic            | `src/status.ts`                                | `thresholdStatus`, `cardStatus`, `summarize`. Compares the value rounded to `decimals`, so the shown number and status agree. A card with no points has `status: null`, is stale, and isn't counted                                                                                                                                                                                         |
| Page markup             | `src/view.ts`, `src/render.ts`, `src/build.ts` | `npm run build` writes `dist/index.html` (`DATA_DIR`/`DIST_DIR` override). Semantic HTML: a section per scenario, an `<article>` per card, `data-status`/`data-stale`/`data-fetch-failed` hooks for CSS. A source's `attribution`, when set, replaces the "Source: name." line as the link text (owner's decision) |
| Page styling            | `src/styles.ts`, `src/render.ts`, `DESIGN.md`  | "River Gauge" direction (contract in `.impeccable/surfaces/src-render-ts.md`; system in `DESIGN.md`). One inline stylesheet, `pageCss`. Gauge board, stage bands, method in `<details>`. Checked in a browser 2026-10-18 at 390 and 1280 wide, light and dark; the finish review's verdict was ship |

All three v1 fetchers are registered in `src/fetchers/index.ts`; the `notBuilt` placeholder is gone.

## Next, in order

1. **Scheduled workflow**: `.github/workflows/refresh.yml`. A single job runs refresh, commits `data/`, builds, and deploys to GitHub Pages, all in one workflow. It runs on a cron off the hour (e.g. `17 11 * * *`) and also allows `workflow_dispatch`. It needs a `timeout-minutes` limit and an `SEC_USER_AGENT` repository secret. The spec's Refresh section explains why it's one job.
   - The owner creates the secret and enables Pages; ask them to do this. The remote is `github.com/narcisolobo/ai-bubble-watch`.

## Open decisions (the owner's call)

- **Lagging company flag.** For now, a gap in the newest calendar quarter that all five companies have reached makes `capexHistory` throw, so the card shows "fetch failed". Gaps in older quarters skip just those points (owner's decision, 2026-10-18). No separate flag marks a company whose newest 10-Q isn't out yet. Each company's `periodEnd` is exposed, and `maxAgeDays` covers staleness.
- **Optional hardening.** These were left out on purpose. Offer them; don't add them unasked.
  - `readData` checks only that the file is valid JSON, not its fields.
  - The Treasury parser doesn't check the date format.
- **Distance-to-next-stage readout.** The finish review suggested a line like "18.2 pp below Alert" on each card. It's new copy, so it waits for your call.
- **Board caption.** "Scale matches the chart below." is singular, but it captions three staffs. "Each staff uses the same scale as its card's chart." was offered; the approved text stays until you decide.
- **Permission-gated indicators** (VIX, HY OAS, AI stock basket, GPU prices) and **v2 model API prices**: not started, and need the owner's decision.

## Gotchas learned the hard way

- **Treasury** returns HTTP 200 with an empty body for a year that has no rows yet. The parser treats that as zero rows.
- **Treasury's** "10 Yr" column moved when "1.5 Month" was added in 2025. Find columns by header name.
- **Treasury's** CSVs have no trailing newline, so `wc -l` undercounts their rows by one.
- **SEC** returns 403 without a `User-Agent`.
  - The `fy`/`fp` fields describe the filing, not the period. Identify periods by `start`/`end`.
  - The frames API is unreliable for these companies.
  - The capex history starts at 2018-06-30 because Amazon's `PaymentsToAcquireProductiveAssets` quarters start at 2017-09-30. MSFT operating cash flow has a gap at 2016-10 and ORCL's at 2017-06, both before that start.
  - The latest capex point trails Oracle's newest quarter. Oracle's Jun–Aug quarter is calendar Q3, so it waits for the others' Sep 30 10-Qs (late October). Until then, the latest point is Q2 2026 (81.8%), using Oracle's FY2026. The 82.9% in `sec-capex.test.ts` mixes Oracle's Aug quarter with the others' June quarters, so it isn't a point on the chart.
  - The Treasury fetcher downloads only this year's and last year's files, so the 2-year sparkline starts at Jan 2025 until history accumulates (it merges). A one-off backfill of earlier years would fill it now.
- **Page build**: the render tests check structure with ids and regexes, because Node has no built-in HTML parser. Their `text()` helper turns every tag into a space, so "…</a>." reads as "… ." in assertions.
- **Fed GZ CSV** values have full float precision (e.g. `0.9259102941329188`), not the two decimals the spec example shows. The history has no gaps, so the parser throws on a blank value rather than skipping it: in `replace` mode, a skipped month would be deleted.
- **Page styling**:
  - The gauge staff's gradient and the chart's latest-point dot assume higher-is-worse, which every v1 indicator is. Only the SVG bands handle both directions.
  - On phone the staff is 64px tall, so the tick numerals touch if an indicator's watch band is under about 18% of its chart's range.
  - The design detector flags the tick numerals as low-contrast and cramped, because it measures them against the staff they sit inside in the markup. CSS moves them off the staff onto the page background. The finish reviewer confirmed these are false positives.
  - The page has only been built from scratch data, since `data/` isn't committed yet. The scheduled workflow will create it.
- **FRED** isn't used anywhere: its terms forbid storing its data, and the useful series are copyrighted. Get public-domain data from the original government source instead.
