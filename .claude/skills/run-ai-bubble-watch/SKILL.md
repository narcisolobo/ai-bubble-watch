---
name: run-ai-bubble-watch
description: Run, build, smoke-test, and screenshot AI Bubble Watch. Use when asked to run the refresh, build the page, check the page renders, take a screenshot at phone or desktop width in light or dark mode, run the tests, or call a fetcher/status/view function directly.
---

AI Bubble Watch is a two-step pipeline, not a server: `src/refresh.ts` fetches SEC, Treasury, and Fed data into `data/*.json`, and `src/build.ts` turns that into a static `dist/index.html`. Drive it with `.claude/skills/run-ai-bubble-watch/smoke.mjs`. It refreshes into a scratch directory, builds, checks every card on the page, and screenshots the page with headless Chrome.

All paths are relative to the repo root. Verified on macOS (Apple silicon) with Node 24 and Google Chrome; not tried on Linux.

## Prerequisites

- Node 24 or later. It runs the `.ts` files directly through type stripping, with no build step.
- Google Chrome, for screenshots only. The driver looks for `$CHROME`, then `/Applications/Google Chrome.app`, then `google-chrome` or `chromium` on PATH.
- Network access to `data.sec.gov`, `home.treasury.gov`, and `www.federalreserve.gov`. None of them need an API key.

```bash
npm install
```

## Run (agent path)

Do a full live run: refresh, build, check, and take four screenshots. It takes about 8 seconds.

```bash
SEC_USER_AGENT="AI Bubble Watch you@example.com" node .claude/skills/run-ai-bubble-watch/smoke.mjs
```

Output (abridged). There is one line per card: status, id, the value shown, and any `[stale, fetch-failed]` flags.

```
== page
summary: 1 normal 2 watch 0 alert 0 no threshold set Last successful refresh: ... All indicators updated on schedule.
watch        hyperscaler-capex-ratio  81.8% , as of Q2 2026
watch        treasury-10y             5.09% , as of Oct 16, 2026
normal       gz-credit-spread         0.93% , as of Sep 2026
uncovered: GPU oversupply / depreciation Valuation pressure Commoditization / price wars
== screenshots
.../ai-bubble-watch-smoke/shots/phone-light.png   (also phone-dark, desktop-light, desktop-dark)
== ok
```

Everything goes under `$TMPDIR/ai-bubble-watch-smoke/` (`data/`, `dist/`, `shots/`). The driver exits 1 in these cases:
- a card is missing;
- a card has no data;
- the uncovered-scenarios section or the disclaimer is missing;
- `SEC_USER_AGENT` is unset and a refresh is needed.

**Read the PNGs before calling it done.**

If you changed only rendering, rebuild from data you already fetched. That skips the network:

```bash
node .claude/skills/run-ai-bubble-watch/smoke.mjs --data "${TMPDIR:-/tmp}/ai-bubble-watch-smoke/data" --out "${TMPDIR:-/tmp}/abw-offline" --no-shots
```

| flag | what it does |
|---|---|
| `--data DIR` | build from existing data in DIR; skips the refresh |
| `--out DIR` | where `data/`, `dist/`, and `shots/` go |
| `--no-shots` | skip the screenshots |
| `--height PX` | screenshot height (default 5200) |

## Direct invocation (most changes need only this)

Most changes touch one fetcher, `src/status.ts`, `src/view.ts`, or `src/render.ts`. Import the function and call it. Node strips the types, so this works on `.ts` files:

```bash
node --input-type=module -e 'const { thresholdStatus } = await import("./src/status.ts"); console.log(thresholdStatus({ direction: "higher-is-worse", watch: 2, alert: 3, rationale: "" }, 1.996, 2));'
# -> watch
```

## Run (human path)

```bash
SEC_USER_AGENT="AI Bubble Watch you@example.com" DATA_DIR=/some/scratch/data npm run refresh
DATA_DIR=/some/scratch/data DIST_DIR=/some/scratch/dist npm run build   # then open dist/index.html
```

Without `DATA_DIR`, refresh writes into the repo's `data/`, which belongs to the scheduled workflow. Don't do that locally.

## Test

```bash
npm test               # 87 tests
npm run typecheck
node --test test/status.test.ts   # one file
```

## Gotchas

- **Headless Chrome on macOS won't make a window narrower than 500px.** `--window-size=390,...` renders at 500 and crops the right edge, which looks like text overflowing the page. The driver loads the page in a 390px `<iframe>` inside a 500px window instead, so the page's viewport really is 390. The white strip right of 390px in the phone shots is the wrapper page, not the app.
- **Color scheme follows the OS unless forced.** The flag is `--blink-settings=preferredColorScheme=0` for dark and `=1` for light. The page declares `<meta name="color-scheme" content="light dark">`, so with no CSS you get the browser's default dark theme.
- **Headless screenshots don't size to the content.** They're a fixed `--height`, and blank space below the footer is normal. Raise `--height` if the footer is cut off.
- **`npm run refresh` exits 0 even when a fetcher fails.** That's deliberate: the page still deploys and shows the failure. Check the driver's per-card line for `[fetch-failed]`. Don't rely on the exit code.
- **SEC returns HTTP 403 without a `User-Agent`.** That's why `SEC_USER_AGENT` is required for any refresh.
- **The screenshots show every "How this is measured" panel closed.** To check the method content, rewrite `<details>` to `<details open>` in a copy of `dist/index.html` and screenshot that. Load the copy in a 390px `<iframe>` for the phone width.
- **The 10-year yield's sparkline starts in Jan 2025.** The Treasury fetcher only downloads this year's and last year's files, and history builds up by merging.
- **`CVDisplayLinkCreateWithCGDisplay failed` lines from Chrome are noise** in headless mode on macOS.
- **The owner commits.** Leave changes uncommitted.

## Troubleshooting

- **`smoke: set SEC_USER_AGENT, ...`**: a refresh needs contact info for SEC. Set it, or pass `--data DIR` to reuse fetched data.
- **Phone screenshot text cut off at the right**: the screenshot was taken with `--window-size` under 500 on macOS. Use the driver, which uses the iframe instead.
- **`smoke: run this from the repo root`**: the driver resolves `config/` and `src/` from the working directory. `cd` to the repo root first.
