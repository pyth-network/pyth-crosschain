/**
 * Shared helpers for the Pro Price Feed Changelog generator.
 *
 * All functions are pure (or filesystem-only) and importable by both
 * the CLI entrypoint and unit tests.
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
  ScalarValue,
} from "../../src/data/pro-price-feed-changelog/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIR_NAME_REGEX = /^\d{4}-\d{2}-\d{2}-T\d{6}-.+/;
const DATE_EXTRACT_REGEX = /^(\d{4}-\d{2}-\d{2})/;

/** Only these metadata keys are allowed in the public output. */
export const SAFE_METADATA_KEYS = new Set([
  "name",
  "description",
  "asset_type",
  "quote_currency",
  "cmc_id",
]);

// ---------------------------------------------------------------------------
// Governance feed schema (input from after.json)
// ---------------------------------------------------------------------------

const governanceMetadataSchema = z.record(z.string(), z.unknown());

export const governanceFeedSchema = z.object({
  feedId: z.number().int(),
  symbol: z.string().optional(),
  state: z.string().optional(),
  exponent: z.number().int().optional(),
  minPublishers: z.number().int().optional(),
  marketSchedule: z.string().optional(),
  metadata: governanceMetadataSchema.optional(),
});
export type GovernanceFeed = z.infer<typeof governanceFeedSchema>;

const afterJsonSchema = z.object({
  feeds: z.array(governanceFeedSchema),
});

// ---------------------------------------------------------------------------
// Public feed record schema (output — strict whitelist)
// ---------------------------------------------------------------------------

export const publicFeedRecordSchema = z
  .object({
    pyth_lazer_id: z.number().int(),
    symbol: z.string().nullable(),
    state: z.string().nullable(),
    exponent: z.number().int().nullable(),
    min_publishers: z.number().int().nullable(),
    schedule: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    asset_type: z.string().nullable(),
    quote_currency: z.string().nullable(),
    cmc_id: z.union([z.string(), z.number()]).nullable(),
  })
  .strict();
export type PublicFeedRecord = z.infer<typeof publicFeedRecordSchema>;

// ---------------------------------------------------------------------------
// listProposalDirs
// ---------------------------------------------------------------------------

export async function listProposalDirs(repoPath: string): Promise<string[]> {
  const entries = await fs.readdir(repoPath, { withFileTypes: true });
  const dirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!DIR_NAME_REGEX.test(entry.name)) {
      console.warn(
        `[warn] Skipping non-conforming directory name: ${sanitizeDirName(entry.name)}`,
      );
      continue;
    }
    dirs.push(entry.name);
  }

  return dirs.sort();
}

// ---------------------------------------------------------------------------
// groupByDate
// ---------------------------------------------------------------------------

export function groupByDate(dirs: string[]): Map<string, string> {
  const dateToLastDir = new Map<string, string>();

  for (const dir of dirs) {
    const match = dir.match(DATE_EXTRACT_REGEX);
    if (!match?.[1]) {
      console.warn(
        `[warn] Cannot extract date from dir: ${sanitizeDirName(dir)}`,
      );
      continue;
    }
    // Sorted input means last write per date wins (= last proposal of that day)
    dateToLastDir.set(match[1], dir);
  }

  return dateToLastDir;
}

// ---------------------------------------------------------------------------
// loadAfterFeeds
// ---------------------------------------------------------------------------

export async function loadAfterFeeds(
  repoPath: string,
  dir: string,
): Promise<GovernanceFeed[]> {
  const filePath = path.join(repoPath, dir, "after.json");
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;

  // Destructure only `feeds` — publishers/governanceSources are never bound
  const { feeds } = afterJsonSchema.parse(parsed);
  return feeds;
}

// ---------------------------------------------------------------------------
// transformFeeds — strict whitelist from governance → public format
// ---------------------------------------------------------------------------

export function transformFeeds(feeds: GovernanceFeed[]): PublicFeedRecord[] {
  return feeds.map((feed) => {
    const metadata = feed.metadata ?? {};

    const record: PublicFeedRecord = {
      pyth_lazer_id: feed.feedId,
      symbol: feed.symbol ?? null,
      state: feed.state?.toLowerCase() ?? null,
      exponent: feed.exponent ?? null,
      min_publishers: feed.minPublishers ?? null,
      schedule: feed.marketSchedule ?? null,
      name:
        typeof metadata.name === "string" ? metadata.name : null,
      description:
        typeof metadata.description === "string"
          ? metadata.description
          : null,
      asset_type:
        typeof metadata.asset_type === "string"
          ? metadata.asset_type
          : null,
      quote_currency:
        typeof metadata.quote_currency === "string"
          ? metadata.quote_currency
          : null,
      cmc_id:
        typeof metadata.cmc_id === "string" ||
        typeof metadata.cmc_id === "number"
          ? metadata.cmc_id
          : null,
    };

    // Validate with strict schema — unknown keys cause hard failure
    return publicFeedRecordSchema.parse(record);
  });
}

// ---------------------------------------------------------------------------
// diffStates — operates only on transformed public records
// ---------------------------------------------------------------------------

export function diffStates(
  date: string,
  before: PublicFeedRecord[],
  after: PublicFeedRecord[],
): DailyRollup {
  const beforeById = new Map(before.map((r) => [r.pyth_lazer_id, r]));
  const afterById = new Map(after.map((r) => [r.pyth_lazer_id, r]));

  const allIds = new Set([...beforeById.keys(), ...afterById.keys()]);
  const changes: ChangeEntry[] = [];
  const totals: Record<ChangeType, number> = {
    went_live: 0,
    added: 0,
    changed: 0,
    removed: 0,
  };

  for (const id of [...allIds].sort((a, b) => a - b)) {
    const prev = beforeById.get(id);
    const curr = afterById.get(id);

    if (!prev && curr) {
      changes.push({
        changeType: "added",
        pythLazerId: id,
        symbol: curr.symbol ?? "unknown",
        name: curr.name ?? "unknown",
        statusBefore: null,
        statusAfter: curr.state,
        changedFields: [],
      });
      totals.added++;
      continue;
    }

    if (prev && !curr) {
      changes.push({
        changeType: "removed",
        pythLazerId: id,
        symbol: prev.symbol ?? "unknown",
        name: prev.name ?? "unknown",
        statusBefore: prev.state,
        statusAfter: null,
        changedFields: [],
      });
      totals.removed++;
      continue;
    }

    if (!prev || !curr) continue;

    const changedFields = diffRecordFields(prev, curr);
    if (changedFields.length === 0) continue;

    const wentLive =
      curr.state === "stable" &&
      prev.state !== null &&
      prev.state !== "stable";

    const changeType: ChangeType = wentLive ? "went_live" : "changed";
    changes.push({
      changeType,
      pythLazerId: id,
      symbol: curr.symbol ?? "unknown",
      name: curr.name ?? "unknown",
      statusBefore: prev.state,
      statusAfter: curr.state,
      changedFields,
    });
    totals[changeType]++;
  }

  return { date, totals, changes };
}

// ---------------------------------------------------------------------------
// diffRecordFields — field-level diff between two public records
// ---------------------------------------------------------------------------

function diffRecordFields(
  before: PublicFeedRecord,
  after: PublicFeedRecord,
): FieldDiff[] {
  const fields: FieldDiff[] = [];

  for (const key of Object.keys(before).sort()) {
    if (key === "pyth_lazer_id") continue;

    const bVal = before[key as keyof PublicFeedRecord] as ScalarValue;
    const aVal = after[key as keyof PublicFeedRecord] as ScalarValue;

    if (bVal === aVal) continue;
    // Handle null comparisons and type coercion edge cases
    if (
      bVal !== null &&
      aVal !== null &&
      String(bVal) === String(aVal)
    )
      continue;

    fields.push({ path: key, before: bVal, after: aVal });
  }

  return fields;
}

// ---------------------------------------------------------------------------
// sanitizeDirName
// ---------------------------------------------------------------------------

export function sanitizeDirName(dir: string): string {
  const match = dir.match(DATE_EXTRACT_REGEX);
  return match?.[1] ?? "[invalid]";
}

// ---------------------------------------------------------------------------
// loadExistingRollup
// ---------------------------------------------------------------------------

export async function loadExistingRollup(
  rollupPath: string,
): Promise<DailyRollupFile | null> {
  try {
    const content = await fs.readFile(rollupPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    // Accept both old `endpoint` and new `source` field for backward compat during migration
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "endpoint" in parsed &&
      !("source" in parsed)
    ) {
      const obj = parsed as Record<string, unknown>;
      obj.source = obj.endpoint;
      delete obj.endpoint;
    }
    return parsed as DailyRollupFile;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// checkShrinkage — abort if >50% entries lost
// ---------------------------------------------------------------------------

export function checkShrinkage(
  existing: DailyRollupFile,
  proposed: DailyRollupFile,
): void {
  if (existing.days.length === 0) return;

  const ratio = proposed.days.length / existing.days.length;
  if (ratio < 0.5) {
    throw new Error(
      `Shrinkage guard: proposed rollup has ${String(proposed.days.length)} days vs existing ${String(existing.days.length)} (${String(Math.round(ratio * 100))}%). Aborting to prevent data loss.`,
    );
  }
}
