# AI Bubble Watch

A one-page dashboard that tracks a few public indicators associated with AI-sector overheating and shows whether any of them have crossed set thresholds.

It reports data and nothing more. It makes no predictions and gives no investment advice.

**Live page:** https://narcisolobo.github.io/ai-bubble-watch/

## v1 indicators

| Indicator | Source | Frequency |
| --- | --- | --- |
| Hyperscaler capex as % of operating cash flow (MSFT, AMZN, GOOGL, META, ORCL) | SEC EDGAR XBRL API | Quarterly |
| 10-year Treasury yield | U.S. Treasury daily yield curve | Daily |
| Corporate credit spread (GZ spread) | Federal Reserve Board | Monthly |

All three sources are public and need no API key. Each indicator shows a status of normal, watch, or alert, based on thresholds in a config file.

## How it works

A daily GitHub Actions job fetches the data, commits it to `data/`, builds a static `index.html`, and deploys it to GitHub Pages. The pipeline is TypeScript on Node. The published page is static HTML and CSS with little or no JavaScript.

## Run it locally

Needs Node 24 or newer.

```sh
npm ci
npm test
npm run typecheck

# Fetch data into a scratch directory, then build the page from it
export SEC_USER_AGENT="AI Bubble Watch you@example.com"
DATA_DIR=/tmp/abw-data npm run refresh
DATA_DIR=/tmp/abw-data npm run build   # writes dist/index.html
```

`SEC_USER_AGENT` is required: SEC returns 403 without contact info. Use a scratch `DATA_DIR` for local runs, since the repo's `data/` belongs to the scheduled workflow. `DIST_DIR` overrides the build output directory.

## Docs

- [Spec](docs/spec.md): features, indicators, thresholds, stack, and acceptance criteria
- [Data source research](docs/research/data-sources.md): licensing and API details for each candidate source, and why some were left out of v1
- [Status](docs/status.md): what's done, what's next, and gotchas
- [Product and copy guidance](PRODUCT.md) and [design system](DESIGN.md)
