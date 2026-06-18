/**
 * Shared types and helpers for the Change Log snapshot/diff/generate
 * scripts. Kept outside `src/` so it can be imported by both
 * `snapshot-and-diff.ts` (writes daily diff JSONs) and
 * `generate-changelog.ts` (bundles diffs into the rendered TS module).
 */

export type PythSymbol = {
  pyth_lazer_id: number;
  name: string;
  symbol: string;
  description?: string | null;
  asset_type: string;
  state: string;
  hermes_id?: string | null;
  quote_currency?: string | null;
};

export type ChangeType = "added" | "went_live" | "removed";

export type Entry = {
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
  events: Entry[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────

export const isDeprecated = (s: PythSymbol): boolean => {
  const desc = (s.description ?? "").toUpperCase();
  return (
    desc.includes("DEPRECATED") ||
    s.asset_type.toUpperCase().includes("DEPRECATED")
  );
};

export const toTitleCase = (raw: string): string =>
  raw.toLowerCase().replaceAll(/\b([a-z])/g, (_, c: string) => c.toUpperCase());

export const extractAssetName = (s: PythSymbol): string => {
  const desc = s.description?.replace(/^DEPRECATED FEED\s*-?\s*/i, "").trim();
  if (desc && desc.length > 0) {
    const [base] = desc.split("/");
    return toTitleCase((base ?? "").trim());
  }
  const sym = s.symbol.split(".").pop() ?? s.symbol;
  return sym.split("/")[0] ?? sym;
};

export const dayLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
};

export const synthesizeHero = (s: DaySummary): string => {
  const parts: string[] = [];
  if (s.added > 0) {
    parts.push(
      `${s.added.toString()} new feed${s.added === 1 ? "" : "s"} announced`,
    );
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

const baseEntry = (s: PythSymbol, date: string): Omit<Entry, "changeType"> => ({
  asset: extractAssetName(s),
  assetType: s.asset_type,
  date,
  id: s.symbol,
  lazerId: s.pyth_lazer_id,
  ...(s.quote_currency == null ? {} : { quote: s.quote_currency }),
  ...(s.hermes_id == null ? {} : { hermesId: s.hermes_id }),
});

/**
 * Diff one pair of snapshots into a single Day entry. Diff rules:
 *
 *   - new pyth_lazer_id today (not in yesterday, not deprecated) → added
 *   - missing pyth_lazer_id today (was in yesterday)              → removed
 *   - state coming_soon → stable                                   → went_live
 *   - state stable → inactive                                      → removed
 *   - description gains "DEPRECATED FEED"                          → removed
 */
export const diffPair = (
  yesterday: PythSymbol[],
  today: PythSymbol[],
  date: string,
): Day => {
  const ymap = new Map<number, PythSymbol>(
    yesterday.map((s) => [s.pyth_lazer_id, s]),
  );
  const tmap = new Map<number, PythSymbol>(
    today.map((s) => [s.pyth_lazer_id, s]),
  );

  const events: Entry[] = [];

  for (const s of today) {
    if (!ymap.has(s.pyth_lazer_id) && !isDeprecated(s)) {
      events.push({ ...baseEntry(s, date), changeType: "added" });
    }
  }

  for (const s of yesterday) {
    if (!tmap.has(s.pyth_lazer_id)) {
      events.push({ ...baseEntry(s, date), changeType: "removed" });
    }
  }

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

  const order: Record<ChangeType, number> = {
    added: 2,
    removed: 0,
    went_live: 1,
  };
  events.sort((a, b) => {
    const ord = order[a.changeType] - order[b.changeType];
    return ord === 0 ? b.lazerId - a.lazerId : ord;
  });

  const summary: DaySummary = {
    added: events.filter((e) => e.changeType === "added").length,
    removed: events.filter((e) => e.changeType === "removed").length,
    went_live: events.filter((e) => e.changeType === "went_live").length,
  };

  return {
    date,
    events,
    hero: synthesizeHero(summary),
    label: dayLabel(date),
    summary,
  };
};
