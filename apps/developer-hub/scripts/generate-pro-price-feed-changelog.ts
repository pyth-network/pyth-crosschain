/**
 * Daily changelog generator for Pyth Pro price feed IDs.
 *
 * Usage: pnpm run generate:pro-price-feed-changelog
 *
 * Fetches the current state of all Pyth Pro symbols, saves a UTC-dated
 * snapshot, computes an incremental diff against the previous day's
 * snapshot, and prepends the result to daily-rollups.json. Snapshots
 * older than 10 days are pruned automatically.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type {
  ChangeEntry,
  ChangeType,
  DailyRollup,
  DailyRollupFile,
  FieldDiff,
} from "../src/data/pro-price-feed-changelog/types";

const SYMBOLS_ENDPOINT =
  "https://history.pyth-lazer.dourolabs.app/history/v1/symbols";
const SNAPSHOT_RETENTION_DAYS = 10;
const FETCH_TIMEOUT_MS = 30_000;

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA_DIR = path.join(
  SCRIPT_DIR,
  "..",
  "src",
  "data",
  "pro-price-feed-changelog",
);
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const ROLLUPS_PATH = path.join(
  SCRIPT_DIR,
  "..",
  "public",
  "data",
  "pro-price-feed-changelog",
  "daily-rollups.json",
);

const symbolRecordSchema = z
  .object({
    pyth_lazer_id: z.number().int().positive(),
    state: z.string().nullish(),
    symbol: z.string().nullish(),
    name: z.string().nullish(),
  })
  .passthrough();

type SymbolRecord = z.infer<typeof symbolRecordSchema>;

type SnapshotPayload = {
  date: string;
  records: SymbolRecord[];
};

async function main() {
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
  await fs.mkdir(path.dirname(ROLLUPS_PATH), { recursive: true });

  const today = utcDate();
  const todaySnapshotPath = path.join(SNAPSHOTS_DIR, `${today}.json`);

  const symbols = await fetchCurrentSymbols();

  if (!(await fileExists(todaySnapshotPath))) {
    const snapshot: SnapshotPayload = { date: today, records: symbols };
    await fs.writeFile(
      todaySnapshotPath,
      `${JSON.stringify(snapshot)}\n`,
    );
  }

  const previousSnapshot = await loadPreviousSnapshot(today);
  const rollupFileExisted = await fileExists(ROLLUPS_PATH);
  const existingRollup = await loadExistingRollup();

  let updated = false;
  if (
    previousSnapshot &&
    !existingRollup.days.some((d) => d.date === today)
  ) {
    const newDay = buildDailyRollup({
      previous: previousSnapshot,
      current: { date: today, records: symbols },
    });
    if (newDay.changes.length > 0) {
      existingRollup.days.unshift(newDay);
      updated = true;
    }
  }

  if (updated || !rollupFileExisted) {
    existingRollup.generatedAt = new Date().toISOString();
    await fs.writeFile(
      ROLLUPS_PATH,
      `${JSON.stringify(existingRollup)}\n`,
    );
  }

  await pruneOldSnapshots();

  console.log(
    `Done. ${existingRollup.days.length} day(s) in rollup, ${symbols.length} symbols tracked.`,
  );
}

async function fetchCurrentSymbols(): Promise<SymbolRecord[]> {
  const response = await fetch(SYMBOLS_ENDPOINT, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch symbols: ${response.status} ${response.statusText}`,
    );
  }

  const rawData: unknown = await response.json();
  if (!Array.isArray(rawData)) {
    throw new Error("Unexpected symbols payload shape: expected an array");
  }

  if (rawData.length > 50_000) {
    throw new Error(
      `Unexpected record count (${rawData.length}), aborting as safety measure`,
    );
  }

  const records: SymbolRecord[] = [];
  for (const item of rawData) {
    const result = symbolRecordSchema.safeParse(item);
    if (result.success) {
      records.push(sortKeys(result.data) as SymbolRecord);
    }
  }

  return records.toSorted((a, b) => a.pyth_lazer_id - b.pyth_lazer_id);
}

async function loadPreviousSnapshot(
  excludeDate: string,
): Promise<SnapshotPayload | null> {
  const files = await fs.readdir(SNAPSHOTS_DIR);
  const snapshotDates = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .filter((d) => d < excludeDate)
    .toSorted((a, b) => b.localeCompare(a));

  const mostRecentDate = snapshotDates[0];
  if (!mostRecentDate) return null;

  const filePath = path.join(SNAPSHOTS_DIR, `${mostRecentDate}.json`);
  return JSON.parse(
    await fs.readFile(filePath, "utf8"),
  ) as SnapshotPayload;
}

async function loadExistingRollup(): Promise<DailyRollupFile> {
  try {
    const content = await fs.readFile(ROLLUPS_PATH, "utf8");
    return JSON.parse(content) as DailyRollupFile;
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      endpoint: SYMBOLS_ENDPOINT,
      days: [],
    };
  }
}

function buildDailyRollup({
  previous,
  current,
}: {
  previous: SnapshotPayload;
  current: SnapshotPayload;
}): DailyRollup {
  const previousById = new Map<number, SymbolRecord>(
    previous.records.map((r) => [r.pyth_lazer_id, r]),
  );
  const currentById = new Map<number, SymbolRecord>(
    current.records.map((r) => [r.pyth_lazer_id, r]),
  );

  const allIds = new Set<number>([
    ...previousById.keys(),
    ...currentById.keys(),
  ]);
  const changes: ChangeEntry[] = [];
  const totals: Record<ChangeType, number> = {
    went_live: 0,
    added: 0,
    changed: 0,
    removed: 0,
  };

  for (const id of [...allIds].toSorted((a, b) => a - b)) {
    const before = previousById.get(id);
    const after = currentById.get(id);

    if (!before && after) {
      changes.push({
        changeType: "added",
        pythLazerId: id,
        symbol: String(after.symbol ?? "unknown"),
        name: String(after.name ?? "unknown"),
        statusBefore: null,
        statusAfter: after.state ?? null,
        changedFields: [],
      });
      totals.added++;
      continue;
    }

    if (before && !after) {
      changes.push({
        changeType: "removed",
        pythLazerId: id,
        symbol: String(before.symbol ?? "unknown"),
        name: String(before.name ?? "unknown"),
        statusBefore: before.state ?? null,
        statusAfter: null,
        changedFields: [],
      });
      totals.removed++;
      continue;
    }

    if (!before || !after) continue;

    const changedFields = diffValues(before, after);
    if (changedFields.length === 0) continue;

    const statusBefore = before.state ?? null;
    const statusAfter = after.state ?? null;
    const wentLive =
      statusAfter === "stable" &&
      statusBefore !== null &&
      statusBefore !== "stable";

    const changeType: ChangeType = wentLive ? "went_live" : "changed";
    changes.push({
      changeType,
      pythLazerId: id,
      symbol: String(after.symbol ?? "unknown"),
      name: String(after.name ?? "unknown"),
      statusBefore,
      statusAfter,
      changedFields,
    });
    totals[changeType]++;
  }

  return { date: current.date, totals, changes };
}

/**
 * Computes field-level diffs between two values.
 *
 * Precondition: object keys should be sorted consistently (via sortKeys)
 * for the JSON.stringify fast-path comparison to work correctly.
 */
function diffValues(
  before: unknown,
  after: unknown,
  pathPrefix = "",
): FieldDiff[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];

  const beforeIsObject =
    typeof before === "object" && before !== null && !Array.isArray(before);
  const afterIsObject =
    typeof after === "object" && after !== null && !Array.isArray(after);

  if (beforeIsObject && afterIsObject) {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    const keys = new Set([
      ...Object.keys(beforeObj),
      ...Object.keys(afterObj),
    ]);
    const fields: FieldDiff[] = [];
    for (const key of [...keys].toSorted((a, b) => a.localeCompare(b))) {
      const nextPath = pathPrefix === "" ? key : `${pathPrefix}.${key}`;
      fields.push(
        ...diffValues(
          beforeObj[key] ?? null,
          afterObj[key] ?? null,
          nextPath,
        ),
      );
    }
    return fields;
  }

  return [{ path: pathPrefix === "" ? "$" : pathPrefix, before, after }];
}

/**
 * Recursively sorts object keys for deterministic comparison.
 * Filters out prototype pollution keys (__proto__, constructor, prototype).
 */
function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => !BLOCKED_KEYS.has(key))
      .toSorted((a, b) => a.localeCompare(b))
      .map((key) => [key, sortKeys(record[key])]),
  );
}

async function pruneOldSnapshots() {
  const files = await fs.readdir(SNAPSHOTS_DIR);
  const snapshotFiles = files
    .filter((f) => f.endsWith(".json"))
    .toSorted((a, b) => b.localeCompare(a));

  const toDelete = snapshotFiles.slice(SNAPSHOT_RETENTION_DAYS);
  for (const fileName of toDelete) {
    await fs.unlink(path.join(SNAPSHOTS_DIR, fileName));
    console.log(`Pruned old snapshot: ${fileName}`);
  }
}

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

await main();
