# What's left before v1 ships

As of 2026-10-18. Checked against the acceptance criteria in [spec.md](spec.md#acceptance-criteria-for-v1). Day-to-day progress lives in [status.md](status.md).

## Blocking

Nothing blocks v1. The last criterion, **scheduled refresh runs daily, builds, and deploys without manual action**, was met by the first run on 2026-10-18. Still to confirm: the next scheduled (not manual) run fires.

- [x] **Write `.github/workflows/refresh.yml`** (agent). One job: run the refresh, commit `data/`, build, deploy to GitHub Pages. It has to be one job: a push made with `GITHUB_TOKEN` doesn't trigger other workflows ([spec, Refresh](spec.md#refresh)).
  - Cron off the hour, e.g. `17 11 * * *`, plus `workflow_dispatch` for manual runs.
  - A `timeout-minutes` limit.
  - Reads `SEC_USER_AGENT` from a repository secret.
- [x] **Add the `SEC_USER_AGENT` repository secret** (owner) on `github.com/narcisolobo/ai-bubble-watch`, e.g. `AI Bubble Watch you@example.com`. SEC returns 403 without it.
- [x] **Enable GitHub Pages** (owner) with "GitHub Actions" as the source.
- [x] **First run, then check the live page** (agent and owner). `data/` isn't in the repo yet; the first run creates and commits it. Until then the page has only been built from scratch data, so "builds from the committed data" is unchecked.

## Met

| Criterion                                                              | Evidence                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Three indicators show value, date, trend, source, attribution          | All three cards, checked in a browser 2026-10-18                                                              |
| Indicators and thresholds in config                                    | `config/indicators.ts`                                                                                        |
| Status correct at and around thresholds, both directions               | `test/status.test.ts`                                                                                         |
| Quarterly capex matches company-reported figures, one case per company | `test/sec-capex.test.ts`: Oracle and Amazon each have their own test; Alphabet, Microsoft, and Meta share one |
| Failed fetch keeps the last value, marked and listed in the summary    | `test/status.test.ts`, `test/render.test.ts`                                                                  |
| Data older than `maxAgeDays` marked stale                              | `test/status.test.ts`                                                                                         |
| Scenarios without an indicator listed                                  | `test/render.test.ts`; on the page                                                                            |
| Usable on a phone and in dark mode                                     | Checked at 390 and 1280 wide, light and dark; finish review verdict: ship                                     |
| Disclaimer footer present                                              | `test/render.test.ts`                                                                                         |

## Not blocking: your calls

None of these hold up v1. Details are in [status.md](status.md#open-decisions-the-owners-call).

- **Board caption.** "Scale matches the chart below." is singular for three staffs. The offered alternative is "Each staff uses the same scale as its card's chart."
- **Distance-to-next-stage line.** The finish review suggested a line on each card like "18.2 pp below Alert". It's new copy.
- **Lagging company flag.** Nothing marks a company whose newest 10-Q isn't out yet.
- **Optional hardening.** `readData` checks only for valid JSON, and the Treasury parser doesn't check the date format.
- **Treasury backfill.** A one-off fetch of earlier years would fill the yield chart before Jan 2025. Otherwise history builds up a day at a time.
- **Later indicators and v2 model API prices.** Not started; they need permission or a decision.

## After launch

- **The 60-day rule.** GitHub disables scheduled workflows in public repos after 60 days without repository activity. Push a commit at least every 60 days, or re-enable the workflow with `gh workflow enable` if it stops.
- **Threshold review** after a couple of months of live data ([spec, Open Items](spec.md#open-items)).
