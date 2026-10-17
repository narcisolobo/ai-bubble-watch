// One refresh: run every indicator's fetcher and apply the result to its
// data file. See docs/spec.md, "Refresh".

import type { FetchContext, Fetcher, FetcherId, IndicatorConfig } from "./schema.ts";
import { applyFailure, applySuccess, readData, writeData } from "./store.ts";

export interface RunOptions {
  indicators: IndicatorConfig[];
  fetchers: Record<FetcherId, Fetcher>;
  dataDir: string;
  ctx: FetchContext;
}

export interface RunReport {
  results: { id: string; ok: boolean; error?: string }[];
}

export async function run({ indicators, fetchers, dataDir, ctx }: RunOptions): Promise<RunReport> {
  const results: RunReport["results"] = [];
  for (const indicator of indicators) {
    // An unreadable data file is reported but never overwritten: its history
    // is still recoverable from git, and a failure record would replace it.
    let existing;
    try {
      existing = await readData(dataDir, indicator.id);
    } catch (err) {
      results.push({ id: indicator.id, ok: false, error: (err as Error).message });
      continue;
    }

    // A fetcher error and an unusable result (e.g. no points) both count as
    // a failed fetch: the last good points stay and the attempt is recorded.
    let next;
    try {
      const result = await fetchers[indicator.source.fetcher](ctx);
      next = applySuccess(existing, indicator.id, result, ctx.now);
      results.push({ id: indicator.id, ok: true });
    } catch (err) {
      const error = (err as Error).message;
      next = applyFailure(existing, indicator.id, error, ctx.now);
      results.push({ id: indicator.id, ok: false, error });
    }
    await writeData(dataDir, next);
  }
  return { results };
}
