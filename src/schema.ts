// Shapes shared by the config, the stored data, and the fetchers.
// See docs/spec.md, "Configuration" and "Storage".

// ---------------------------------------------------------------------------
// Config (config/indicators.ts)
// ---------------------------------------------------------------------------

export type ScenarioId =
  | "revenue-vs-capex"
  | "debt-stress"
  | "gpu-oversupply"
  | "valuation"
  | "macro-shock"
  | "commoditization";

export interface Scenario {
  id: ScenarioId;
  name: string;
}

/** Fetchers that exist in src/fetchers/. Adding one means adding its id here. */
export type FetcherId = "sec-capex" | "treasury-yield" | "fed-gz-spread";

export interface IndicatorConfig {
  /** Also the data file name: data/{id}.json */
  id: string;
  name: string;
  /** One plain-English sentence on why it matters. */
  description: string;
  scenarios: ScenarioId[];
  source: {
    name: string;
    /** Human-facing page the card links to (not necessarily the API endpoint). */
    url: string;
    fetcher: FetcherId;
    /** Attribution text the source requires, shown on the card. */
    attribution?: string;
  };
  /** Why public display is allowed. */
  license: string;
  /** What the value is, when it differs from the raw series. */
  metric?: string;
  /** Units of `value` and of the thresholds, e.g. "%". */
  units: string;
  decimals: number;
  frequency: "daily" | "monthly" | "quarterly";
  /** Change shown on the card: over calendar days, or over a number of data points. */
  changePeriod: { days: number } | { points: number };
  /** Flag the card stale when its latest `date` is older than this. */
  maxAgeDays: number;
  /** Card caveats, shown as short notes. */
  notes?: string[];
  /** Years of history the sparkline shows, back from the latest point. Absent means all. */
  sparklineYears?: number;
  /** A `secondary` series drawn as a second sparkline line, on the same scale as `value`. */
  sparklineOverlay?: string;
  /**
   * Labels and formats for the values in `secondary` and `breakdown`, keyed
   * by name. The card shows them in this order; a key not listed isn't shown.
   */
  fields?: Record<string, FieldFormat>;
  /** Absent means status "no threshold set". */
  thresholds?: Thresholds;
}

export interface FieldFormat {
  label: string;
  /** "%" or "USD"; see formatValue in src/view.ts. */
  units: string;
  decimals: number;
}

export interface Thresholds {
  direction: "higher-is-worse" | "lower-is-worse";
  /** A value equal to a threshold counts as crossing it. */
  watch: number;
  alert: number;
  /** One sentence, shown on the card, on where these numbers come from. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Stored data (data/{indicator id}.json)
// ---------------------------------------------------------------------------

export interface IndicatorData {
  id: string;
  /** Sorted by `date`, oldest first. One point per date. */
  points: Point[];
  /** Last fetch that succeeded, or null if none has. */
  lastSuccessAt: string | null;
  /** Last fetch attempt, successful or not. */
  lastAttempt: Attempt | null;
}

export interface Point {
  /** Observation date (YYYY-MM-DD). For a period value, the period's end. */
  date: string;
  /** Start of the period, for monthly or quarterly values. */
  periodStart?: string;
  /** In the indicator's `units`. */
  value: number;
  /** Extra series shown alongside `value`, e.g. { ebp: -0.39 }. */
  secondary?: Record<string, number>;
  /** Parts that make up `value`, e.g. one row per company. */
  breakdown?: BreakdownRow[];
  sourceUrl: string;
  /** ISO timestamp of the fetch that produced this point. */
  fetchedAt: string;
}

export interface BreakdownRow {
  label: string;
  periodStart: string;
  periodEnd: string;
  values: Record<string, number>;
}

export interface Attempt {
  /** ISO timestamp. */
  at: string;
  ok: boolean;
  /** Present when `ok` is false. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Fetcher contract (what run() calls)
// ---------------------------------------------------------------------------

export interface FetchContext {
  fetch: typeof globalThis.fetch;
  /** Contact User-Agent, from the SEC_USER_AGENT environment variable. */
  userAgent: string;
  /** ISO timestamp for `fetchedAt`, so one run stamps every point the same. */
  now: string;
}

export interface FetchResult {
  points: Point[];
  /**
   * "merge": upsert by `date`; a new value for an existing date replaces it.
   * "replace": the source revises its whole history, so swap it in entirely.
   */
  mode: "merge" | "replace";
}

export type Fetcher = (ctx: FetchContext) => Promise<FetchResult>;
