// Applies fetch results to the per-indicator data files in data/.
// See docs/spec.md, "Storage".

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FetchResult, IndicatorData, Point } from "./schema.ts";

/** Reads data/{id}.json, or returns null if the indicator has no file yet. */
export async function readData(dir: string, id: string): Promise<IndicatorData | null> {
  const path = join(dir, `${id}.json`);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(text) as IndicatorData;
  } catch (err) {
    throw new Error(`${path}: not valid JSON (${(err as Error).message})`);
  }
}

/**
 * Writes data/{id}.json. Writes a temporary file and renames it into place,
 * so a crash mid-write can't leave a truncated file.
 */
export async function writeData(dir: string, data: IndicatorData): Promise<void> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${data.id}.json`);
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmp, path);
}

/** The data file after a successful fetch. `existing` is null on the first run. */
export function applySuccess(
  existing: IndicatorData | null,
  id: string,
  result: FetchResult,
  at: string,
): IndicatorData {
  // An empty result almost certainly means the source's format changed or
  // the parser broke. Applying it with "replace" would wipe the history.
  if (result.points.length === 0) {
    throw new Error(`${id}: fetch returned no points`);
  }

  const byDate = new Map<string, Point>();
  const kept = result.mode === "merge" ? (existing?.points ?? []) : [];
  for (const p of kept) byDate.set(p.date, p);
  for (const p of result.points) byDate.set(p.date, p);
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return { id, points, lastSuccessAt: at, lastAttempt: { at, ok: true } };
}

/** The data file after a failed fetch: only the attempt changes. */
export function applyFailure(
  existing: IndicatorData | null,
  id: string,
  error: string,
  at: string,
): IndicatorData {
  return {
    id,
    points: existing?.points ?? [],
    lastSuccessAt: existing?.lastSuccessAt ?? null,
    lastAttempt: { at, ok: false, error },
  };
}
