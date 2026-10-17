// Maps each fetcher id in the config to its implementation. The type
// requires an entry for every FetcherId in src/schema.ts.

import type { Fetcher, FetcherId } from "../schema.ts";
import { treasuryYield } from "./treasury-yield.ts";

/** Placeholder until the fetcher exists; run() records the error as a failed fetch. */
function notBuilt(id: FetcherId): Fetcher {
  return async () => {
    throw new Error(`${id} fetcher not built yet`);
  };
}

export const fetchers: Record<FetcherId, Fetcher> = {
  "sec-capex": notBuilt("sec-capex"),
  "treasury-yield": treasuryYield,
  "fed-gz-spread": notBuilt("fed-gz-spread"),
};
