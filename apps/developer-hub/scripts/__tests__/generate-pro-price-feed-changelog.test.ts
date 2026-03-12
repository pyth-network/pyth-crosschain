/**
 * @jest-environment node
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type {
  DailyRollupFile,
} from "../../src/data/pro-price-feed-changelog/types";
import { publicFeedRecordSchema } from "../lib/pro-price-feed-changelog";
import {
  checkShrinkage,
  diffStates,
  groupByDate,
  listProposalDirs,
  loadAfterFeeds,
  loadExistingRollup,
  sanitizeDirName,
  transformFeeds,
} from "../lib/pro-price-feed-changelog";
import type { GovernanceFeed } from "../lib/pro-price-feed-changelog";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GOVERNANCE_FEED_MINIMAL: GovernanceFeed = {
  feedId: 1,
  symbol: "BTC/USD",
  state: "Stable",
  exponent: -8,
  minPublishers: 3,
  marketSchedule: "24/7",
  metadata: {
    name: "Bitcoin",
    description: "Bitcoin price",
    asset_type: "crypto",
    quote_currency: "USD",
    cmc_id: "1",
  },
};

const GOVERNANCE_FEED_WITH_SENSITIVE: GovernanceFeed = {
  feedId: 2,
  symbol: "ETH/USD",
  state: "ComingSoon",
  exponent: -8,
  metadata: {
    name: "Ethereum",
    description: "Ethereum price",
    asset_type: "crypto",
    quote_currency: "USD",
    cmc_id: 1027,
    // Sensitive fields that should NOT appear in output
    hermes_id: "0xabcdef1234567890",
    internal_notes: "do not expose",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "changelog-test-"));
}

async function writeAfterJson(
  base: string,
  dirName: string,
  feeds: GovernanceFeed[],
): Promise<void> {
  const dir = path.join(base, dirName);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "after.json"),
    JSON.stringify({
      feeds,
      publishers: [{ id: "secret-pub-1" }],
      governanceSources: [{ key: "secret-key" }],
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests: listProposalDirs
// ---------------------------------------------------------------------------

describe("listProposalDirs", () => {
  it("returns sorted valid dirs and skips invalid names", async () => {
    const tmp = await makeTempDir();
    await fs.mkdir(path.join(tmp, "2026-03-10-T120000-add-btc"));
    await fs.mkdir(path.join(tmp, "2026-03-09-T080000-add-eth"));
    await fs.mkdir(path.join(tmp, "not-a-valid-dir"));
    await fs.writeFile(path.join(tmp, "some-file.txt"), "");

    const dirs = await listProposalDirs(tmp);
    expect(dirs).toEqual([
      "2026-03-09-T080000-add-eth",
      "2026-03-10-T120000-add-btc",
    ]);
  });

  it("returns empty array for empty directory", async () => {
    const tmp = await makeTempDir();
    expect(await listProposalDirs(tmp)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: groupByDate
// ---------------------------------------------------------------------------

describe("groupByDate", () => {
  it("groups dirs by date, last dir wins", () => {
    const dirs = [
      "2026-03-09-T080000-proposal-a",
      "2026-03-09-T120000-proposal-b",
      "2026-03-10-T060000-proposal-c",
    ];
    const result = groupByDate(dirs);
    expect(result.get("2026-03-09")).toBe("2026-03-09-T120000-proposal-b");
    expect(result.get("2026-03-10")).toBe("2026-03-10-T060000-proposal-c");
    expect(result.size).toBe(2);
  });

  it("skips dirs that cannot extract date", () => {
    const result = groupByDate(["invalid-dir-name"]);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: sanitizeDirName
// ---------------------------------------------------------------------------

describe("sanitizeDirName", () => {
  it("extracts date from valid dir name", () => {
    expect(sanitizeDirName("2026-03-10-T120000-add-btc")).toBe("2026-03-10");
  });

  it("returns [invalid] for non-conforming names", () => {
    expect(sanitizeDirName("not-a-date")).toBe("[invalid]");
  });
});

// ---------------------------------------------------------------------------
// Tests: loadAfterFeeds
// ---------------------------------------------------------------------------

describe("loadAfterFeeds", () => {
  it("loads and parses feeds from after.json, ignoring publishers", async () => {
    const tmp = await makeTempDir();
    await writeAfterJson(tmp, "2026-03-10-T120000-test", [
      GOVERNANCE_FEED_MINIMAL,
    ]);

    const feeds = await loadAfterFeeds(tmp, "2026-03-10-T120000-test");
    expect(feeds).toHaveLength(1);
    expect(feeds[0]?.feedId).toBe(1);
  });

  it("throws on missing after.json", async () => {
    const tmp = await makeTempDir();
    await fs.mkdir(path.join(tmp, "2026-03-10-T120000-empty"));

    await expect(
      loadAfterFeeds(tmp, "2026-03-10-T120000-empty"),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: transformFeeds — whitelist enforcement
// ---------------------------------------------------------------------------

describe("transformFeeds", () => {
  it("transforms governance feed to public format with only whitelisted fields", () => {
    const result = transformFeeds([GOVERNANCE_FEED_MINIMAL]);
    expect(result).toHaveLength(1);

    const record = result[0]!;
    expect(record.pyth_lazer_id).toBe(1);
    expect(record.symbol).toBe("BTC/USD");
    expect(record.state).toBe("stable"); // lowercased
    expect(record.exponent).toBe(-8);
    expect(record.min_publishers).toBe(3);
    expect(record.schedule).toBe("24/7");
    expect(record.name).toBe("Bitcoin");
    expect(record.description).toBe("Bitcoin price");
    expect(record.asset_type).toBe("crypto");
    expect(record.quote_currency).toBe("USD");
    expect(record.cmc_id).toBe("1");

    // Strict schema passes
    expect(() => publicFeedRecordSchema.parse(record)).not.toThrow();
  });

  it("excludes sensitive metadata fields", () => {
    const result = transformFeeds([GOVERNANCE_FEED_WITH_SENSITIVE]);
    const record = result[0]!;
    const json = JSON.stringify(record);

    expect(json).not.toContain("hermes_id");
    expect(json).not.toContain("internal_notes");
    expect(json).not.toContain("0xabcdef");
    expect(json).not.toContain("do not expose");
  });

  it("handles missing optional fields with null", () => {
    const minimal: GovernanceFeed = { feedId: 99 };
    const result = transformFeeds([minimal]);
    const record = result[0]!;

    expect(record.pyth_lazer_id).toBe(99);
    expect(record.symbol).toBeNull();
    expect(record.state).toBeNull();
    expect(record.name).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: diffStates
// ---------------------------------------------------------------------------

describe("diffStates", () => {
  it("detects added feeds", () => {
    const after = transformFeeds([GOVERNANCE_FEED_MINIMAL]);
    const day = diffStates("2026-03-10", [], after);

    expect(day.changes).toHaveLength(1);
    expect(day.changes[0]?.changeType).toBe("added");
    expect(day.totals.added).toBe(1);
  });

  it("detects removed feeds", () => {
    const before = transformFeeds([GOVERNANCE_FEED_MINIMAL]);
    const day = diffStates("2026-03-10", before, []);

    expect(day.changes).toHaveLength(1);
    expect(day.changes[0]?.changeType).toBe("removed");
    expect(day.totals.removed).toBe(1);
  });

  it("detects went_live transition", () => {
    const feedBefore: GovernanceFeed = {
      ...GOVERNANCE_FEED_MINIMAL,
      state: "ComingSoon",
    };
    const feedAfter: GovernanceFeed = {
      ...GOVERNANCE_FEED_MINIMAL,
      state: "Stable",
    };

    const before = transformFeeds([feedBefore]);
    const after = transformFeeds([feedAfter]);
    const day = diffStates("2026-03-10", before, after);

    expect(day.changes).toHaveLength(1);
    expect(day.changes[0]?.changeType).toBe("went_live");
    expect(day.totals.went_live).toBe(1);
  });

  it("detects changed fields", () => {
    const feedBefore: GovernanceFeed = {
      ...GOVERNANCE_FEED_MINIMAL,
      exponent: -8,
    };
    const feedAfter: GovernanceFeed = {
      ...GOVERNANCE_FEED_MINIMAL,
      exponent: -6,
    };

    const before = transformFeeds([feedBefore]);
    const after = transformFeeds([feedAfter]);
    const day = diffStates("2026-03-10", before, after);

    expect(day.changes).toHaveLength(1);
    expect(day.changes[0]?.changeType).toBe("changed");
    expect(day.changes[0]?.changedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "exponent", before: -8, after: -6 }),
      ]),
    );
  });

  it("reports no changes for identical states", () => {
    const feeds = transformFeeds([GOVERNANCE_FEED_MINIMAL]);
    const day = diffStates("2026-03-10", feeds, feeds);

    expect(day.changes).toHaveLength(0);
  });

  it("produces only scalar values in FieldDiff.before/after", () => {
    const feedBefore: GovernanceFeed = { ...GOVERNANCE_FEED_MINIMAL };
    const feedAfter: GovernanceFeed = {
      ...GOVERNANCE_FEED_MINIMAL,
      metadata: {
        ...GOVERNANCE_FEED_MINIMAL.metadata,
        name: "Bitcoin Updated",
      },
    };

    const before = transformFeeds([feedBefore]);
    const after = transformFeeds([feedAfter]);
    const day = diffStates("2026-03-10", before, after);

    for (const change of day.changes) {
      for (const field of change.changedFields) {
        expect(
          field.before === null ||
            typeof field.before === "string" ||
            typeof field.before === "number" ||
            typeof field.before === "boolean",
        ).toBe(true);
        expect(
          field.after === null ||
            typeof field.after === "string" ||
            typeof field.after === "number" ||
            typeof field.after === "boolean",
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: loadExistingRollup
// ---------------------------------------------------------------------------

describe("loadExistingRollup", () => {
  it("returns null for missing file", async () => {
    const result = await loadExistingRollup("/nonexistent/path.json");
    expect(result).toBeNull();
  });

  it("loads and parses existing rollup", async () => {
    const tmp = await makeTempDir();
    const filePath = path.join(tmp, "rollup.json");
    const data: DailyRollupFile = {
      generatedAt: "2026-03-09T00:00:00Z",
      source: "pyth-network/pyth-lazer-governance",
      days: [],
    };
    await fs.writeFile(filePath, JSON.stringify(data));

    const result = await loadExistingRollup(filePath);
    expect(result).toEqual(data);
  });

  it("migrates old endpoint field to source", async () => {
    const tmp = await makeTempDir();
    const filePath = path.join(tmp, "rollup.json");
    await fs.writeFile(
      filePath,
      JSON.stringify({
        generatedAt: "2026-03-09T00:00:00Z",
        endpoint: "https://old-endpoint.example.com",
        days: [],
      }),
    );

    const result = await loadExistingRollup(filePath);
    expect(result?.source).toBe("https://old-endpoint.example.com");
    expect((result as Record<string, unknown>).endpoint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: checkShrinkage
// ---------------------------------------------------------------------------

describe("checkShrinkage", () => {
  const makeRollup = (dayCount: number): DailyRollupFile => ({
    generatedAt: "2026-03-09T00:00:00Z",
    source: "test",
    days: Array.from({ length: dayCount }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      totals: { went_live: 0, added: 0, changed: 0, removed: 0 },
      changes: [],
    })),
  });

  it("does not throw when days count is stable", () => {
    expect(() => checkShrinkage(makeRollup(10), makeRollup(10))).not.toThrow();
  });

  it("does not throw for empty existing rollup", () => {
    expect(() => checkShrinkage(makeRollup(0), makeRollup(5))).not.toThrow();
  });

  it("throws when >50% entries lost", () => {
    expect(() => checkShrinkage(makeRollup(10), makeRollup(4))).toThrow(
      /Shrinkage guard/,
    );
  });

  it("does not throw at exactly 50%", () => {
    expect(() => checkShrinkage(makeRollup(10), makeRollup(5))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: FULL_REBUILD behavior (integration-style)
// ---------------------------------------------------------------------------

describe("incremental append", () => {
  it("merges new days into existing rollup without duplicates", () => {
    const existingDay: DailyRollupFile["days"][number] = {
      date: "2026-03-09",
      totals: { went_live: 1, added: 0, changed: 0, removed: 0 },
      changes: [
        {
          changeType: "went_live",
          pythLazerId: 1,
          symbol: "BTC/USD",
          name: "Bitcoin",
          statusBefore: "coming_soon",
          statusAfter: "stable",
          changedFields: [],
        },
      ],
    };

    const newDay = diffStates(
      "2026-03-10",
      transformFeeds([GOVERNANCE_FEED_MINIMAL]),
      transformFeeds([{ ...GOVERNANCE_FEED_MINIMAL, exponent: -6 }]),
    );

    const merged = [existingDay, newDay].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]?.date).toBe("2026-03-10");
    expect(merged[1]?.date).toBe("2026-03-09");
  });
});
