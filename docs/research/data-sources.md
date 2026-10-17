# AI Bubble Watch: data source research

Researched 2026-10-16. All API responses quoted below were fetched that day. Status labels:

- **Verified**: checked against a primary source (official docs, terms, a live endpoint, or SEC filings).
- **Partial**: primary source checked, but part of the claim relies on inference or on a page that could not be fully read.
- **Unverified**: no primary source found. The claim is secondary or open.

This is not legal advice. Where terms restrict public display, the conservative reading is the one given.

## Summary

| Source | Usable for v1 (public page)? | Key caveat |
| --- | --- | --- |
| SEC EDGAR XBRL API (capex) | **Yes** | 10-Q cash-flow facts are mostly year-to-date, so quarters must be derived by differencing. Each company uses different concepts and has its own quirks. User-Agent required, 10 req/s. |
| US Treasury daily yield curve CSV (10Y) | **Yes** | Public domain (US government work). |
| Fed Board Excess Bond Premium / GZ spread CSV | **Yes** (monthly) | Public domain. Staff research product, and the whole history can be revised each month. |
| FRED: DGS10 | Yes, but prefer Treasury direct | Needs an API key. The FRED terms contain a no-"store, cache, or archive" clause and a required notice. |
| FRED: BAMLH0A0HYM2 (HY OAS) | **No**, unless ICE grants permission | "Reproduction of this data in any form is prohibited". Only 3 years of history served (since April 2026). |
| FRED: VIXCLS | Permission needed | Cboe copyright. FRED terms say to contact the owner for non-personal use. |
| FRED: SP500 | Permission needed | S&P copyright, "prior written permission" required. 10 years of history only. |
| FRED: NASDAQ100 | Permission needed | Nasdaq copyright. FRED terms say to contact the owner. |
| Cboe VIX_History.csv (direct) | No | Cboe site terms allow "personal non-commercial use" only. |
| Alpha Vantage free | No, without written OK | 25 req/day. The license is "personal, non-commercial", and anything beyond "private and individual" use counts as commercial. |
| Tiingo free | No | "Internal Use Only… you may not display or share the data". |
| Twelve Data free | No | "Internal non-display usage". Free-tier data may not be used commercially. |
| Financial Modeling Prep free | No | Personal license. May not "integrate the Data… into any tools or applications accessible by any third parties". |
| Finnhub free | No | No redistributing "data or derived results". |
| Massive (ex-Polygon) free | No | "Individual use", "personal, non-commercial, and non-business". |
| Yahoo Finance (unofficial) | No | Undocumented endpoint. ToS bans automated collection and commercial reuse. |
| Stooq | No | CSV endpoint now sits behind a JavaScript proof-of-work bot check. Terms not found. |
| Silicon Data (SDH100RT) | No | Paid API (Pro $998/mo). Redistribution needs a "separate index licence". |
| Ornn OCPI | No | A keyless API works, but the ToS bars public display "through any website… dashboard". |
| vast.ai API | No | ToS bars using its data to "construct, publish, or maintain any index, benchmark". |
| Azure Retail Prices API (H100 VM) | **Partial yes** | Public and unauthenticated. List prices barely move (H100 on-demand unchanged since 2023-12-01). Reuse terms not found. |
| AWS Price List Bulk API | Partial | Public offer files, but the EC2 us-east-1 file is about 481 MB. |
| GCP Cloud Billing Catalog | Partial | Requires an API key. |
| GitHub Actions cron | Yes, with care | Public repos lose cron after 60 days of no "repository activity", and the docs don't define that term. GITHUB_TOKEN pushes don't trigger other workflows. Runs can be delayed or dropped. |

---

## 1. SEC EDGAR XBRL: hyperscaler capex

### Access rules (Verified)

- No key is needed: "These APIs do not require any authentication or API keys to access." ([SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces))
- Rate limit: "Current max request rate: 10 requests/second." ([Accessing EDGAR Data](https://www.sec.gov/os/accessing-edgar-data)). The privacy policy says the same: "Current guidelines limit users to a total of no more than 10 requests per second" and "We reserve the right to block IP addresses that submit excessive requests." ([SEC privacy & security policy](https://www.sec.gov/privacy))
- User-Agent: "Please declare your user agent in request headers", with the sample format "Sample Company Name AdminContact@<sample company domain>.com" ([Accessing EDGAR Data](https://www.sec.gov/os/accessing-edgar-data)). Tested: a request with no User-Agent got **HTTP 403**. With `User-Agent: AI Bubble Watch research narcisolobo@gmail.com` it got 200.
- Reuse: "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission." ([SEC privacy policy](https://www.sec.gov/privacy))
- "data.sec.gov does not support Cross Origin Resource Scripting (CORS)", so fetch it server-side or in CI, not from the browser. XBRL APIs update with "a typical delay of under a minute". ([SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces))

### Endpoints queried (Verified)

`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` for MSFT (0000789019), AMZN (0001018724), GOOGL (0001652044), META (0001326801), and ORCL (0001341439). Also `companyconcept/CIK0001341439/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment.json` and `frames/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment/USD/CY2026Q2.json`.

### Capex concepts by company (Verified from companyfacts)

| Company | Capex concept (us-gaap) | Statement label | Latest filing seen | 10-Q durations present |
| --- | --- | --- | --- | --- |
| MSFT (FYE Jun 30) | `PaymentsToAcquirePropertyPlantAndEquipment` | "Additions to property and equipment" | 10-K filed 2026-07-29 (FY ending 2026-06-30: $115,948M) | **3-month and YTD** |
| AMZN (FYE Dec 31) | `PaymentsToAcquireProductiveAssets` (its `PaymentsToAcquirePropertyPlantAndEquipment` series stops at 2017-03-31) | "Purchases of property and equipment" | 10-Q filed 2026-07-31 (Q2 2026: $54,208M) | **3-month, YTD, and trailing-twelve-month** |
| GOOGL (FYE Dec 31) | `PaymentsToAcquirePropertyPlantAndEquipment` | | 10-Q filed 2026-07-23 (6M 2026: $80,598M) | **YTD only** (Q1 is 3-month by definition) |
| META (FYE Dec 31) | `PaymentsToAcquirePropertyPlantAndEquipment` | | 10-Q filed 2026-07-30 (6M 2026: $49,113M) | **YTD only** |
| ORCL (FYE May 31) | `PaymentsToAcquirePropertyPlantAndEquipment` (its `PaymentsForProceedsFromProductiveAssets` series ends in 2011) | "Capital expenditures" | 10-Q filed 2026-09-11 (Jun–Aug 2026: $28,499M) | **YTD only** |

Related concepts that are present: `FinanceLeasePrincipalPayments` (all five, though ORCL's last value is for the period ending 2026-02-28), `RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability` (non-cash PP&E acquired under finance leases), and `CapitalExpendituresIncurredButNotYetPaid`.

### YTD and Q4 derivation (Verified)

- 10-Q cash-flow facts are year-to-date. Example: GOOGL's 10-Q filed 2026-07-23 has `start 2026-01-01, end 2026-06-30, val 80,598M` and no 3-month Q2 fact. So Q2 = 80,598 − 35,674 (Q1) = **$44,924M**.
- 10-Ks contain only full-year facts, so **Q4 = FY − 9-month YTD from the Q3 10-Q**. Example: GOOGL Q4 2025 = 91,447 − 63,596 = $27,851M. MSFT Q4 FY2026 (Apr–Jun 2026) = 115,948 − 80,146 = $35,802M.
- Checked against company press releases (8-K Ex-99.1). Oracle's table shows FY2026 quarters of $8,502 / $12,033 / $18,635 / $16,493M, total $55,663M. The XBRL derivation gives the same numbers: Q2 = 20,535 − 8,502 = 12,033, and Q4 = 55,663 − 39,170 = 16,493. ([ORCL Q1 FY27 release](https://www.sec.gov/Archives/edgar/data/1341439/000119312526387905/orcl-ex99_1.htm))
- Implementation rule: identify periods by `start`/`end` only. Dedupe on (start, end), keeping the latest `filed`. Pick durations of about 90 days directly, and derive the rest by differencing consecutive YTD values within the same fiscal year.

### Quirks (Verified unless noted)

- **`fy`/`fp` describe the filing, not the period.** Comparative prior-year facts carry the new filing's `fy`. Oracle's 10-Q for Jun–Aug 2026 is labeled `fy 2026, fp Q1`, but Oracle calls that quarter "Q1 FISCAL 2027" ([release](https://www.sec.gov/Archives/edgar/data/1341439/000119312526387905/orcl-ex99_1.htm)).
- **Frames API is unreliable for these companies.** Frames use "duration 91 days +/- 30 days" and "the dates that best align with a calendar quarter or year" ([SEC APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)). As a result, AMZN's trailing-twelve-month fact (2025-07-01 to 2026-06-30) is tagged frame `CY2026`, and MSFT's FY ending 2024-06-30 is tagged `CY2024`. The `CY2026Q2` frame had **none** of MSFT, GOOGL, META, or ORCL, because they report Q2 as YTD or not on a calendar basis. Use companyfacts or companyconcept instead.
- **Oracle**: fiscal year ends May 31 (`fiscalYearEnd: 0531` in the [submissions API](https://data.sec.gov/submissions/CIK0001341439.json)). Oracle also reports a non-GAAP "Net Cash Outlay for Capital Expenditures", which is capex less "other short-term financing cash flow related to capital expenditures" and "customer prepayments with significant financing component for capital expenditures". For Q1 FY27 that is $17,966M against $28,499M of reported capex ([release](https://www.sec.gov/Archives/edgar/data/1341439/000119312526387905/orcl-ex99_1.htm)). Only the GAAP line is in us-gaap XBRL in a clean form. ORCL `FinanceLeasePrincipalPayments` is absent from the FY2026 10-K and the Q1 FY27 10-Q.
- **Amazon finance leases**: the cash-flow supplemental line "Property and equipment acquired under finance leases, net of remeasurements and modifications" (Q2 2026: $563M) matches `RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability` (563M). "Principal repayments of finance leases" ($395M in Q2 2026) is `FinanceLeasePrincipalPayments`. "Proceeds from property and equipment sales and incentives" ($1,132M in Q2 2026) **is not in companyfacts**, which suggests a company extension element: no standard concept carried that value. If you want Amazon's net capex, you need the filing itself. ([AMZN Q2 2026 release](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000024/amzn-20260630xex991.htm)). The extension-element explanation is **Partial**: it is inferred from the value being absent.
- **Microsoft finance leases**: FY2026 `RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability` = $24,608M, which is non-cash and outside the $115,948M cash capex. The FY2026 10-K also says: "we had additional leases, primarily for datacenters, that had not yet commenced of $ 329.1 billion". Cash used in other investing rose "$22.2 billion… primarily to facilitate the purchase of components" ([MSFT 10-K](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm)). Cash capex alone therefore understates the buildout. Microsoft's "capex including finance leases" headline figure was not found in the filings or the press release (**Unverified**).
- **Meta**: its headline figure is "Capital expenditures, including principal payments on finance leases, were $31.08 billion" for Q2 2026 ([META release](https://www.sec.gov/Archives/edgar/data/1326801/000162828026050596/meta-06302026xexhibit991.htm)). Reproduced from XBRL: PP&E (49,113 − 18,997 = 30,116) + `FinanceLeasePrincipalPayments` (1,805 − 843 = 962) = 31,078. Both facts are YTD.
- **Alphabet** also reports `FinanceLeasePrincipalPayments` (3-month value in the lease note: Q2 2026 = $318M), but its headline capex is PP&E only.

### Operating cash flow (Verified, added 2026-10-16)

For the capex ÷ operating cash flow ratio. Checked against the same companyfacts downloads.

- All five companies use `us-gaap:NetCashProvidedByUsedInOperatingActivities`, current through their latest filings. MSFT and ORCL also have `...ContinuingOperations` series, but those stop in 2017–2018, so ignore them.
- Durations follow the same pattern as capex. MSFT 10-Qs have 3-month and YTD values. AMZN has 3-month, YTD and TTM. GOOGL and META have YTD only. ORCL has YTD only (Q1 is 3-month by definition). Q4 = 10-K full year − 9-month YTD.
- Cross-checks against press releases (8-K Ex-99.1):
  - AMZN Q2 2026: 3-month fact 45,387M; the release shows "Net cash provided by (used in) operating activities … 45,387".
  - META Q2 2026: 64,088 − 32,226 = 31,862M; the release says "Cash flow from operating activities was $31.86 billion".
  - ORCL Q1 FY27: 23,103M; the release shows "Net cash provided by operating activities 23,103".
  - MSFT and GOOGL weren't checked against a release. MSFT Q4 FY2026 would be 182,935 − 127,494 = 55,441M.
- **Oracle quirk:** its Q1 FY27 operating cash flow includes "customer prepayments with significant financing component" of $11,363M (about half the $23,103M). These prepayments are the ones Oracle subtracts in its non-GAAP "net cash outlay for capital expenditures". They raise operating cash flow and so lower Oracle's capex ratio.
- Latest-quarter capex ÷ OCF, for context: AMZN 54,208 / 45,387 ≈ 119%. META 30,116 / 31,862 ≈ 95%. GOOGL 44,924 / 39,069 ≈ 115%. ORCL 28,499 / 23,103 ≈ 123%. MSFT (Apr–Jun 2026) 35,802 / 55,441 ≈ 65%.

---

## 2. FRED

### API key and terms (Verified)

- Key required: "All web service requests require an API key" ([FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html)). A test call without a key returned `"Variable api_key is not set."`
- Required notice: "Place the following notice prominently on your application: 'This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.'" ([FRED API Terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html))
- Third-party data: "Data series available through the FRED® API, may be owned by third parties and subject to copyright restrictions." "Before using data series owned by third parties for anything other than your own personal use," "you must contact the data owner to obtain permission." "Copyrighted series contain the word 'Copyright' in their notes." ([FRED legal](https://fred.stlouisfed.org/legal/), [API terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html))
- **Caching/archiving**: the API prohibitions include "Use the FRED® API in connection with storing, caching, or archiving any portion of the FRED® Services or FRED® Content;" … "incorporating any FRED® Content in any database, compilation, archive, cache, or other medium." The site terms also prohibit, without prior written consent, "Store, cache, or archive any portion of the FRED® Services or FRED® Content;" ([FRED legal](https://fred.stlouisfed.org/legal/)). This conflicts with the spec's "keep history" file store. For the public-domain series (DGS10), get the data from the original government source instead (see the recommendations section).
- Scraping: "Don't do any data mining, scraping or extraction of FRED data." ([FRED legal](https://fred.stlouisfed.org/legal/)). The keyless `fredgraph.csv` download should not be used as a fetcher.
- Rate limit: FRED's own pages don't state one. Third-party sources say 120 requests/minute per key (**Unverified**, e.g. [apis.io](https://apis.io/rate-limits/fred/fred-rate-limits/)).

### Series checks

History was checked with a one-time manual `fredgraph.csv` download on 2026-10-16. Notes are from each series page.

| Series | Range served | Latest obs | Copyright note (series page) | Status |
| --- | --- | --- | --- | --- |
| [BAMLH0A0HYM2](https://fred.stlouisfed.org/series/BAMLH0A0HYM2) | **2023-10-17 → 2026-10-15** (about 3 years) | 3.23% | "Starting in April 2026, this series will only include 3 years of observations." "Copyright, 2023, ICE Data Indices. Reproduction of this data in any form is prohibited" | Verified |
| [VIXCLS](https://fred.stlouisfed.org/series/VIXCLS) | 1990-01-02 → 2026-10-15 | 16.46 | "Copyright, 2016, Chicago Board Options Exchange, Inc. Reprinted with permission." | Verified |
| [DGS10](https://fred.stlouisfed.org/series/DGS10) | 1962-01-02 → 2026-10-15 | 5.10% | No owner copyright in the notes. Source is the Fed Board's H.15 release. The page shows only the generic banner "Data in this graph are copyrighted. Please review the copyright information in the series notes before sharing." | Partial (the banner appears to be site-wide) |
| [NASDAQ100](https://fred.stlouisfed.org/series/NASDAQ100) | 1986-01-02 → 2026-10-15 | 29,935.59 | "Copyright © 2016, NASDAQ OMX Group, Inc." | Verified |
| [SP500](https://fred.stlouisfed.org/series/SP500) | **2016-10-17 → 2026-10-16** (10 years) | 7,659.44 | "Reproduction of S&P 500 in any form is prohibited except with the prior written permission of S&P Dow Jones Indices LLC" | Verified |

### Public-domain alternatives (Verified)

- **Treasury yield curve CSV**: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv` returned 200, with a 10 Yr value of 5.09 on 10/16/2026. US government works: "Copyright protection under this title is not available for any work of the United States Government" ([17 U.S.C. §105](https://www.law.cornell.edu/uscode/text/17/105)). Treasury's own [site policies](https://home.treasury.gov/subfooter/site-policies-and-notices) page has no reuse statement (Partial).
- **Fed Board Excess Bond Premium / GZ spread** (credit-stress proxy, monthly): `https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv` returned 200, with columns `date,gz_spread,ebp,est_prob`, covering 1973-01 → 2026-09. Updates are "posted sometime after 10:00 a.m. on the fourth business day of each month", and "the entire history of the EBP may revise each month" ([FEDS note](https://www.federalreserve.gov/econres/notes/feds-notes/updating-the-recession-risk-and-the-excess-bond-premium-20161006.html)). Board site: "Unless otherwise indicated, information on Board's website is in the public domain" and "may be copied and distributed without permission." "Please cite to the Board as the source" ([Fed disclaimer](https://www.federalreserve.gov/disclaimer.htm)).
- **Cboe VIX direct**: `https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv` works (it redirects to `cdn-api.cboe.com`, with data from 1990 → 2026-10-15), but the Cboe terms say "You may view, print and download one copy of the Materials for your personal non-commercial use" and you "may not otherwise copy, reproduce… publish… distribute" ([Cboe terms](https://www.cboe.com/terms)). Verified.

---

## 3. Free stock price APIs

| Provider | Free-tier limits | Public display allowed? | Key ToS language | Status |
| --- | --- | --- | --- | --- |
| [Alpha Vantage](https://www.alphavantage.co/terms_of_service/) | "25 API requests per day" ([premium](https://www.alphavantage.co/premium/)). `TIME_SERIES_DAILY_ADJUSTED` is "a premium API function". `outputsize=full` "is available to premium keys" ([docs](https://www.alphavantage.co/documentation/)) | No, without a written agreement | License is "for personal, non-commercial use". Use counts as "commercial use" if it "goes beyond investment analysis, research, testing, monitoring, and any other activities that are private and individual in nature" or if you "provide information… as part of any type of commercial activity that allows individuals or entities other than User to access information". Contact premium@alphavantage.co | Verified |
| [Tiingo](https://www.tiingo.com/about/pricing) | 500 unique symbols/month, 50 req/hour, 1,000 req/day, 1 GB/month | No | Starter license is "Internal Use Only": "Internal use means you may only use the data for your own personal use"; "you may not display or share the data with another person or organization" | Verified (pricing page; the ToS URL returned 404) |
| [Twelve Data](https://twelvedata.com/pricing) | 8 credits/min, 800/day | No | Basic = "Internal non-display usage". Terms §2.3(l): may not "Use Free Tier data for commercial purposes". §2.2(e): "Redistribute or provide external display of Data only if and as expressly authorized". §2.2(c) permits "Derived Data that cannot be reverse-engineered", but the terms don't say derived data may be displayed publicly ([terms](https://twelvedata.com/terms)) | Verified |
| [Financial Modeling Prep](https://site.financialmodelingprep.com/terms-of-service) | 250 calls/day, EOD data, about 5 years of history (FMP's own marketing/FAQ pages; the pricing page didn't render) | No | Personal Use license: may not "integrate the Data or Services into any tools or applications accessible by any third parties, or use the Services to host, share, display, or provide content for others" | Terms Verified; limits Partial |
| [Finnhub](https://finnhub.io/terms-of-service) | Not determined (the pricing page didn't render) | No | "You hereby agree to not redistribute or share access to data or derived results from the data obtained from Finnhub" | Terms Verified; limits Unverified |
| [Massive (formerly Polygon.io)](https://massive.com/pricing) | "5 API Calls / Minute", "2 Years Historical Data", "End of Day Data" | No | Labeled "Individual use": "solely for your own personal, non-commercial, and non-business purposes." Market Data has separate terms, which were not read ([individual ToS](https://massive.com/legal/individuals-terms-of-service)) | Partial |
| Yahoo Finance (unofficial `query1.finance.yahoo.com/v8/finance/chart`) | Undocumented. Returned 200 on the day of testing | No | Yahoo ToS §2(d)(9) bars collecting data "using any automated means", including "robots, spiders, scrapers, data mining tools". §2(e): "you may not access or reuse the Services… for any commercial purpose" ([Yahoo ToS](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)) | Verified |
| Stooq (`stooq.com/q/d/l/?s=nvda.us&i=d`) | Returns an HTML JavaScript proof-of-work challenge, not CSV, for scripted clients | No (not reliably fetchable) | No terms page found (`/terms/` returned 404) | Partial |

**Conclusion**: none of the free tiers checked clearly permits showing prices, or a ratio derived from them, on a public page. The AI-basket indicator needs either written permission (Alpha Vantage is the most likely to grant it for non-commercial use) or a paid redistribution license.

---

## 4. GPU rental price sources

| Source | Access | Terms | Status |
| --- | --- | --- | --- |
| **Silicon Data** (SDH100RT) | Index page shows current values without login (H100 $2.83 on the day checked). Basic plan is free with "30 days of index history" in the portal. "API access available on paid plans". Pro is $998/month ([pricing](https://www.silicondata.com/pricing)) | "A subscription lets your organisation use the data internally." Redistributing or "publishing it to your own clients" is "covered by a separate index licence rather than the plan price." | Verified |
| **Ornn OCPI** | A keyless call to `https://api.ornnai.com/api/gpu/H100%20SXM` returned `{"index_value":3.03,"last_updated":"2026-10-17T00:03:25Z"}`. The markets page says "Three months of daily history are free as JSON through the API without a key" ([data.ornn.com/markets](https://data.ornn.com/markets)). The quickstart examples send a Bearer key ([quickstart](https://data.ornn.com/docs/quickstart)). Also on Bloomberg ([ICE release](https://ir.theice.com/press/news-details/2026/ICE-and-Ornn-to-Launch-GPU-Compute-Futures-Contracts/default.aspx)) | ToS §3(8) prohibits to "publish, display, broadcast, transmit, distribute…" "through any website, application, API, feed, database, dashboard". §6: "No Company Data may be used for external publication, republication, redistribution, resale." §3(6) bars bulk download or caching "except as expressly authorized by the Company in writing" ([terms](https://data.ornn.com/terms)) | Verified |
| **vast.ai** | `https://console.vast.ai/api/v0/bundles/?q=…` is public. 19 rentable on-demand H100 SXM offers, median $2.40/GPU-hr | Prohibited Activities: may not use the data to "construct, publish, or maintain any index, benchmark, pricing-comparison service", or "redistribute, resell, sublicense, publish or otherwise make available to any third party any feed, dataset" ([terms](https://vast.ai/terms)) | Verified |
| **Azure Retail Prices API** | Unauthenticated: "This API gives you an unauthenticated experience to get retail rates" ([docs](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)). `Standard_ND96isr_H100_v5`, eastus (8×H100): Linux on-demand $98.32/hr (about $12.29/GPU-hr, `effectiveStartDate 2023-12-01`), Spot $18.17/hr (effective 2026-01-01) | The docs describe use for "your own tools for internal analysis and price comparison". No API-specific reuse terms found. List prices are public, but a public-display right is **Unverified** | Partial |
| **AWS Price List Bulk API** | `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json` returned 200 without credentials, but is 481,548,240 bytes (Last-Modified 2026-10-15). The Query API needs AWS credentials ([docs](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api.html)) | Not reviewed | Partial |
| **GCP Cloud Billing** | "To get information about public services, SKUs, or prices, you must create an API key." ([docs](https://docs.cloud.google.com/billing/docs/how-to/get-pricing-information-api)) | Not reviewed | Partial |

**Conclusion**: no free, stable, publicly displayable *market* H100 rental index was found. The independent indices (Silicon Data, Ornn) and the marketplace (vast.ai) all forbid public republication. Hyperscaler list prices (Azure) are public and keyless, but they are sticky and track oversupply poorly (spot prices move more). For v1, either drop this indicator, show Azure H100 spot and on-demand list prices with that caveat stated on the card, or ask Ornn or Silicon Data for a non-commercial display license.

---

## 5. GitHub Actions scheduled workflows

All quotes are from [Events that trigger workflows: schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) unless noted.

- **60-day rule (Verified)**: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." This also appears on [Disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows). Re-enable with the UI, `gh workflow enable`, or `PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable` ([REST](https://docs.github.com/en/rest/actions/workflows#enable-a-workflow)).
- **What counts as "activity" (Unverified)**: the official docs do not define it. Third-party guides say pushes, releases, and merges count, and stars and issue comments don't. No primary source says whether a commit pushed by a workflow with `GITHUB_TOKEN` (author `github-actions[bot]`) resets the timer. Keepalive tools such as [efrecon/gh-action-keepalive](https://github.com/efrecon/gh-action-keepalive) look for "authorship activity" and make a dummy commit when there has been none for 41 days. That approach implies bot commits might not be relied on. Note that [gautamkrishnar/keepalive-workflow](https://github.com/gautamkrishnar/keepalive-workflow) now shows "This repository has been disabled… due to a violation of GitHub's terms of service". Treat dummy-commit keepalives as risky. Safer: commit to the repo by hand at least every 60 days, or watch for the disable and re-enable it.
- **GITHUB_TOKEN pushes don't trigger workflows (Verified)**: "events triggered by the `GITHUB_TOKEN` will not create a new workflow run". "`workflow_dispatch` and `repository_dispatch` events always create workflow runs." Reason: "This prevents recursive workflow runs" ([GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token)). So a data commit from the cron job will **not** fire an `on: push` deploy workflow. Build and deploy in the same workflow, or explicitly dispatch the deploy workflow.
- **Delays (Verified, with no stated bound)**: "The `schedule` event can be delayed during periods of high loads". "High load times include the start of every hour." "If the load is sufficiently high enough, some queued jobs may be dropped." "To decrease the chance of delay, schedule your workflow to run at a different time of the hour." The docs give **no maximum delay**, so a specific delay figure is Unverified. Also: "Scheduled workflows run on the latest commit on the default branch". The minimum interval is "once every 5 minutes". "By default, scheduled workflows run in UTC", and an optional IANA `timezone` key exists.
- **Acceptable use (Verified)**: on GitHub-hosted runners, Actions may not be used for "any other activity unrelated to the production, testing, deployment, or publication of the software project" ([Additional product terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)). A daily data refresh that publishes this project's own site falls within "publication". That is an interpretation, not a ruling.

---

## Recommended v1 indicator set

Only sources whose terms clearly permit a public page are listed as "ship". The rest need the owner's opt-in or a permission request.

**Ship in v1 (public domain or public information):**

1. **Hyperscaler capex (quarterly, $)**: SEC companyfacts, using the concepts below.
   - MSFT, GOOGL, META, ORCL: `us-gaap:PaymentsToAcquirePropertyPlantAndEquipment`.
   - AMZN: `us-gaap:PaymentsToAcquireProductiveAssets`.
   - Endpoint: `https://data.sec.gov/api/xbrl/companyconcept/CIK{10-digit}/us-gaap/{Concept}.json` (one call per company per concept). Header: `User-Agent: AI Bubble Watch narcisolobo@gmail.com`. Stay under 10 req/s.
   - Derive discrete quarters from YTD values and Q4 as FY − 9M. Show the sum as a trailing-four-quarter total, labeled with each company's fiscal period.
   - Optional secondary line: add `FinanceLeasePrincipalPayments`, which matches Meta's own definition.
2. **10-Year Treasury yield (daily, %)**: Treasury daily yield curve CSV, column "10 Yr". URL: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{YYYY}/all?type=daily_treasury_yield_curve&field_tdr_date_value={YYYY}&page&_format=csv`.
3. **Corporate credit spread (monthly, %)**: Fed Board GZ spread and Excess Bond Premium, `https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv` (`gz_spread`, `ebp`). Cite "Federal Reserve Board". Overwrite the full history each month, because back values revise. This replaces BAMLH0A0HYM2 for public display.

**Owner opt-in (copyright holder permission needed for a public page):**

4. **Volatility**: FRED `VIXCLS` via `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=$FRED_API_KEY&file_type=json`, with the FRED notice. Cboe copyright applies, and the FRED terms say to contact the owner. The terms' storing/caching clause also needs to be weighed against keeping history.
5. **AI basket vs broad index**: no free source permits public display. Ask Alpha Vantage for written non-commercial permission (premium@alphavantage.co), or buy a redistribution tier.
6. **HY OAS (BAMLH0A0HYM2)**: only with ICE permission. FRED now serves only 3 years.
7. **GPU rental price**: Azure Retail Prices API (`https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and armSkuName eq 'Standard_ND96isr_H100_v5'`), on-demand and Spot ÷ 8 GPUs. Public and keyless, but its reuse terms are unverified and list prices are sticky. Otherwise, request a display license from Ornn or Silicon Data.

**Pipeline notes**: run build and deploy in the same scheduled workflow, at an off-the-hour time (for example `17 11 * * *`). Store each data point with its source URL and fetch timestamp. Show the FRED notice if any FRED series is used. Plan a human commit at least every 60 days, or a check that re-enables the workflow.
