// The data this module exposes is generated at build time by
// `scripts/generate-changelog.ts`, which bundles the daily diff JSONs
// in `data/changelog-diffs/` into a typed module at `generated-data.ts`.
// Diffs themselves are produced by `scripts/snapshot-and-diff.ts`,
// run daily from `.github/workflows/changelog-snapshot.yml`.

import { GENERATED_CHANGE_LOG } from "./generated-data";

// ─── Public types ────────────────────────────────────────────────────────

export type ChangeType = "added" | "went_live" | "removed";

export type ChangeLogEntry = {
  id: string;
  lazerId: number;
  asset: string;
  assetType: string;
  quote?: string;
  hermesId?: string;
  changeType: ChangeType;
  date: string;
};

export type DaySummary = {
  added: number;
  went_live: number;
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

// The change log is bundled at build time, so this is a synchronous read of a
// constant — no fetching, loading, or error states needed at the call site.
export const getChangeLog = (): ChangeLog => GENERATED_CHANGE_LOG;

// ─── Links ───────────────────────────────────────────────────────────────

// Deep-link a feed symbol into the Pyth Terminal explore view. The symbol id
// maps directly onto the route — e.g. `Metal.Index.SILVER/USD` becomes
// `/explore/Metal.Index.SILVER%2FUSD` — and encodeURIComponent escapes the
// slash (and anything else) safely.
export const terminalUrl = (id: string): string =>
  `https://app.pyth.com/explore/${encodeURIComponent(id)}`;

// ─── Display helpers ─────────────────────────────────────────────────────

export const fmtDateShort = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
};

export const fmtDateLong = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
};
