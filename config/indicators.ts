// Indicators, thresholds, and scenarios. Edit here, not in code.
// Field meanings: src/schema.ts. Threshold reasoning: docs/spec.md.

import type { IndicatorConfig, Scenario } from "../src/schema.ts";

export const scenarios: Scenario[] = [
  { id: "revenue-vs-capex", name: "Revenue not catching up to capex" },
  { id: "debt-stress", name: "Debt-funded buildout stress" },
  { id: "gpu-oversupply", name: "GPU oversupply / depreciation" },
  { id: "valuation", name: "Valuation pressure" },
  { id: "macro-shock", name: "Macro shock" },
  { id: "commoditization", name: "Commoditization / price wars" },
];

export const indicators: IndicatorConfig[] = [
  {
    id: "hyperscaler-capex-ratio",
    name: "Hyperscaler capex vs. operating cash flow",
    description:
      "How much of the cash Microsoft, Amazon, Alphabet, Meta, and Oracle generate from operations goes into building data centers and other capital spending.",
    scenarios: ["revenue-vs-capex", "debt-stress"],
    source: {
      name: "SEC EDGAR (company filings)",
      url: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
      fetcher: "sec-capex",
    },
    license: "SEC public information; may be copied or distributed without permission.",
    metric:
      "Combined trailing-four-quarter capex ÷ combined trailing-four-quarter operating cash flow. One point per calendar quarter end, using each company's latest fiscal quarter ending on or before it.",
    units: "%",
    decimals: 1,
    frequency: "quarterly",
    changePeriod: { points: 4 },
    // A quarter's point appears once the last of the five companies files,
    // about 45 days after quarter end; the next quarter adds another 90.
    maxAgeDays: 150,
    notes: [
      "Cash capex excludes finance leases, which are large for some companies.",
      "Oracle's operating cash flow includes large customer prepayments for capex, which lowers its ratio.",
      "Fiscal years differ: Microsoft's ends in June, Oracle's in May.",
    ],
    thresholds: {
      direction: "higher-is-worse",
      watch: 75,
      alert: 100,
      rationale:
        "From 2018 through 2024 the ratio stayed between 36% and 55%; at 100% the companies spend more than their operations bring in.",
    },
  },
  {
    id: "treasury-10y",
    name: "10-year Treasury yield",
    description:
      "The interest rate on 10-year U.S. government debt, which sets the baseline cost of borrowing for the buildout and the discount rate for tech valuations.",
    scenarios: ["macro-shock"],
    source: {
      name: "U.S. Treasury",
      url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve",
      fetcher: "treasury-yield",
    },
    license: "U.S. government work, public domain (17 U.S.C. §105).",
    units: "%",
    decimals: 2,
    frequency: "daily",
    changePeriod: { days: 90 },
    // No data on weekends or federal holidays; a holiday next to a weekend
    // can leave five days between observations and the daily run.
    maxAgeDays: 6,
    thresholds: {
      direction: "higher-is-worse",
      watch: 5.0,
      alert: 5.5,
      rationale:
        "5.0% is about the 90th percentile of daily values since 2000; the yield hasn't reached 5.5% since 2001.",
    },
  },
  {
    id: "gz-credit-spread",
    name: "Corporate credit spread",
    description:
      "The extra interest companies pay to borrow compared with the U.S. government; it rises when lenders get nervous.",
    scenarios: ["debt-stress", "macro-shock"],
    source: {
      name: "Federal Reserve Board",
      url: "https://www.federalreserve.gov/econres/notes/feds-notes/updating-the-recession-risk-and-the-excess-bond-premium-20161006.html",
      fetcher: "fed-gz-spread",
      attribution: "Source: Federal Reserve Board.",
    },
    license: "Federal Reserve Board website content is public domain unless otherwise indicated.",
    metric:
      "GZ spread (monthly). The excess bond premium (EBP), the part not explained by default risk, is shown as a secondary line.",
    units: "%",
    decimals: 2,
    frequency: "monthly",
    changePeriod: { points: 3 },
    // Each month is published on the fourth business day of the next, so a
    // point can be about 37 days old before the next one appears.
    maxAgeDays: 45,
    notes: ["The Fed can revise the whole history each month."],
    thresholds: {
      direction: "higher-is-worse",
      watch: 2.0,
      alert: 3.0,
      rationale:
        "2.0% is about the 75th percentile since 1973; the dot-com bust, 2008, and 2020 all passed 3.0%.",
    },
  },
];
