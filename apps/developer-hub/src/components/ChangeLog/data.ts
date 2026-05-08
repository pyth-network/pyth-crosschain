// The data this module exposes is generated at build time by
// `scripts/generate-changelog.ts`, which bundles the daily diff JSONs
// in `data/changelog-diffs/` into a typed module at `generated-data.ts`.
// Diffs themselves are produced by `scripts/snapshot-and-diff.ts`,
// run daily from `.github/workflows/changelog-snapshot.yml`.

import { GENERATED_CHANGE_LOG } from "./generated-data";

// ─── Public types ────────────────────────────────────────────────────────

export type ChangeType = "added" | "went_live" | "expiring_soon" | "removed";

export type ChangeLogEntry = {
  id: string;
  lazerId: number;
  asset: string;
  assetType: string;
  quote?: string;
  hermesId?: string;
  changeType: ChangeType;
  date: string;
  daysToExpiry?: number;
};

export type DaySummary = {
  added: number;
  went_live: number;
  expiring: number;
  removed: number;
};

export type Day = {
  date: string;
  label: string;
  summary: DaySummary;
  hero: string;
  events: ChangeLogEntry[];
};

export type WeekRollup = {
  start: string;
  end: string;
  totals: DaySummary;
};

export type ChangeLog = {
  days: Day[];
  weekRollup: WeekRollup;
};

// ─── Public API ──────────────────────────────────────────────────────────

export const getChangeLog = (): Promise<ChangeLog> =>
  Promise.resolve(GENERATED_CHANGE_LOG);

// ─── Display helpers ─────────────────────────────────────────────────────

export const fmtDateShort = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
};

export const fmtDateLong = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};
