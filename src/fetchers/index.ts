// Maps each fetcher id in the config to its implementation. The type
// requires an entry for every FetcherId in src/schema.ts.

import type { Fetcher, FetcherId } from "../schema.ts";
import { fedGzSpread } from "./fed-gz-spread.ts";
import { secCapex } from "./sec-capex.ts";
import { treasuryYield } from "./treasury-yield.ts";

export const fetchers: Record<FetcherId, Fetcher> = {
  "sec-capex": secCapex,
  "treasury-yield": treasuryYield,
  "fed-gz-spread": fedGzSpread,
};
