/**
 * Change Log Data Generator
 *
 * Reads daily symbol snapshots from `data/changelog-snapshots/` and produces
 * `src/components/ChangeLog/generated-data.ts`, a typed ChangeLog with one
 * day per pairwise diff. This file is the build-time data source for the
 * `<ChangeLog />` component.
 *
 * Usage:
 *
 *   pnpm generate:changelog
 *
 * The generator runs daily from `.github/workflows/changelog-snapshot.yml`,
 * which also commits both the new snapshot and this regenerated module.
 *
 * ## Diff rules (single snapshot pair: yesterday → today)
 *
 *   - new pyth_lazer_id today (not in yesterday)        → added
 *   - missing pyth_lazer_id today (was in yesterday)    → removed
 *   - state coming_soon → stable                         → went_live
 *   - state stable → inactive                            → removed
 *   - description gains "DEPRECATED FEED"                → removed
 *
 * Other transitions are ignored. `expiring_soon` is not synthesizable from
 * the API alone (no scheduled deactivation date is exposed) — it stays at
 * zero until a richer upstream signal exists.
 */

/* eslint-disable no-console */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = resolve(HERE, "../data/changelog-snapshots");
const OUTPUT_FILE = resolve(
  HERE,
  "../src/components/ChangeLog/generated-data.ts",
);
const DAYS_TO_RENDER = 15;

type Symbol = {
  pyth_lazer_id: number;
  name: string;
  symbol: string;
  description?: string | null;
  asset_type: string;
  state: string;
  hermes_id?: string | null;
  quote_currency?: string | null;
};

type ChangeType = "added" | "went_live" | "expiring_soon" | "removed";

type Entry = {
  id: string;
  lazerId: number;
  asset: string;
  assetType: string;
  quote?: string;
  hermesId?: string;
  changeType: ChangeType;
  date: string;
};

type DaySummary = {
  added: number;
  went_live: number;
  expiring: number;
  removed: number;
};

type Day = {
  date: string;
  label: string;
  summary: DaySummary;
  hero: string;
  events: Entry[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────

const isDeprecated = (s: Symbol): boolean => {
  const desc = (s.description ?? "").toUpperCase();
  return (
    desc.includes("DEPRECATED") ||
    s.asset_type.toUpperCase().includes("DEPRECATED")
  );
};

const toTitleCase = (raw: string): string =>
  raw.toLowerCase().replaceAll(/\b([a-z])/g, (_, c: string) => c.toUpperCase());

const extractAssetName = (s: Symbol): string => {
  const desc = s.description?.replace(/^DEPRECATED FEED\s*-?\s*/i, "").trim();
  if (desc && desc.length > 0) {
    const [base] = desc.split("/");
    return toTitleCase((base ?? "").trim());
  }
  const sym = s.symbol.split(".").pop() ?? s.symbol;
  return sym.split("/")[0] ?? sym;
};

const dayLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
};

const synthesizeHero = (s: DaySummary): string => {
  const parts: string[] = [];
  if (s.added > 0) {
    parts.push(`${s.added.toString()} new feed${s.added === 1 ? "" : "s"} announced`);
  }
  if (s.went_live > 0) {
    parts.push(`${s.went_live.toString()} went live`);
  }
  if (s.removed > 0) {
    parts.push(`${s.removed.toString()} deactivated or deprecated`);
  }
  if (parts.length === 0) {
    return "A quiet day on Pyth. No status transitions on any price feed.";
  }
  return `${parts.join(", ")}.`;
};

const baseEntry = (
  s: Symbol,
  date: string,
): Omit<Entry, "changeType"> => ({
  id: s.symbol,
  lazerId: s.pyth_lazer_id,
  asset: extractAssetName(s),
  assetType: s.asset_type,
  date,
  ...(s.quote_currency == null ? {} : { quote: s.quote_currency }),
  ...(s.hermes_id == null ? {} : { hermesId: s.hermes_id }),
});

// ─── Diff one pair of snapshots ──────────────────────────────────────────

const diffPair = (
  yesterday: Symbol[],
  today: Symbol[],
  date: string,
): Day => {
  const ymap = new Map<number, Symbol>(
    yesterday.map((s) => [s.pyth_lazer_id, s]),
  );
  const tmap = new Map<number, Symbol>(
    today.map((s) => [s.pyth_lazer_id, s]),
  );

  const events: Entry[] = [];

  // Newly seen symbols → added
  for (const s of today) {
    if (!ymap.has(s.pyth_lazer_id) && !isDeprecated(s)) {
      events.push({ ...baseEntry(s, date), changeType: "added" });
    }
  }

  // Disappeared symbols → removed
  for (const s of yesterday) {
    if (!tmap.has(s.pyth_lazer_id)) {
      events.push({ ...baseEntry(s, date), changeType: "removed" });
    }
  }

  // State transitions
  for (const t of today) {
    const y = ymap.get(t.pyth_lazer_id);
    if (!y) continue;
    const prev = y.state;
    const next = t.state;
    const yDep = isDeprecated(y);
    const tDep = isDeprecated(t);

    if (prev === "coming_soon" && next === "stable") {
      events.push({ ...baseEntry(t, date), changeType: "went_live" });
    } else if (prev === "stable" && next === "inactive") {
      events.push({ ...baseEntry(t, date), changeType: "removed" });
    } else if (!yDep && tDep) {
      events.push({ ...baseEntry(t, date), changeType: "removed" });
    }
  }

  // Sort: removed first (more notable), then added, went_live; within each,
  // newest lazer ids first.
  const order: Record<ChangeType, number> = {
    removed: 0,
    went_live: 1,
    added: 2,
    expiring_soon: 3,
  };
  events.sort((a, b) => {
    const ord = order[a.changeType] - order[b.changeType];
    return ord === 0 ? b.lazerId - a.lazerId : ord;
  });

  const summary: DaySummary = {
    added: events.filter((e) => e.changeType === "added").length,
    went_live: events.filter((e) => e.changeType === "went_live").length,
    expiring: 0,
    removed: events.filter((e) => e.changeType === "removed").length,
  };

  return {
    date,
    label: dayLabel(date),
    summary,
    hero: synthesizeHero(summary),
    events,
  };
};

// ─── Top level ───────────────────────────────────────────────────────────

const isoFromFilename = (f: string): string | undefined =>
  /^\d{4}-\d{2}-\d{2}\.json$/.test(f) ? f.replace(/\.json$/, "") : undefined;

const main = (): void => {
  const filenames = readdirSync(SNAPSHOTS_DIR)
    .map((f) => isoFromFilename(f))
    .filter((d): d is string => d !== undefined)
    .sort();

  if (filenames.length === 0) {
    throw new Error(
      `No snapshot files in ${SNAPSHOTS_DIR}. Run \`pnpm snapshot:changelog\` first.`,
    );
  }

  const recent = filenames.slice(-DAYS_TO_RENDER);
  console.log(`Reading ${recent.length.toString()} snapshot(s): ${recent.join(", ")}`);

  const snapshots: { date: string; symbols: Symbol[] }[] = recent.map(
    (date) => ({
      date,
      symbols: JSON.parse(
        readFileSync(resolve(SNAPSHOTS_DIR, `${date}.json`), "utf8"),
      ) as Symbol[],
    }),
  );

  const days: Day[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const yesterday = snapshots[i - 1];
    const today = snapshots[i];
    if (!yesterday || !today) continue;
    days.push(diffPair(yesterday.symbols, today.symbols, today.date));
  }

  const totals: DaySummary = days.reduce<DaySummary>(
    (acc, d) => ({
      added: acc.added + d.summary.added,
      went_live: acc.went_live + d.summary.went_live,
      expiring: acc.expiring + d.summary.expiring,
      removed: acc.removed + d.summary.removed,
    }),
    { added: 0, went_live: 0, expiring: 0, removed: 0 },
  );

  const start = days[0]?.date ?? snapshots.at(-1)?.date ?? "";
  const end = days.at(-1)?.date ?? start;

  const banner = `// AUTO-GENERATED by scripts/generate-changelog.ts — DO NOT EDIT.\n// Source of truth: data/changelog-snapshots/<date>.json files.\n// Re-run with \`pnpm generate:changelog\`.\n`;

  const body = [
    banner,
    `import type { ChangeLog } from "./data";\n`,
    `export const GENERATED_CHANGE_LOG: ChangeLog = ${JSON.stringify(
      { days, weekRollup: { start, end, totals } },
      undefined,
      2,
    )};\n`,
  ].join("\n");

  writeFileSync(OUTPUT_FILE, body, "utf8");

  console.log(
    `Wrote ${days.length.toString()} day diff(s) covering ${start} → ${end} → ${OUTPUT_FILE}`,
  );
};

main();
