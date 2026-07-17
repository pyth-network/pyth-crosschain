import type { SearchableFeed } from "./search";
import { filterFeedsBySearch } from "./search";

type TestFeed = SearchableFeed;

const btc: TestFeed = {
  cmc_id: 1,
  description: "Bitcoin / US Dollar",
  hermes_id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  name: "BTC/USD",
  nasdaq_symbol: null,
  pyth_lazer_id: 1,
  symbol: "Crypto.BTC/USD",
};

const eth: TestFeed = {
  cmc_id: 1027,
  description: "Ether / US Dollar",
  hermes_id: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  name: "ETH/USD",
  nasdaq_symbol: null,
  pyth_lazer_id: 2,
  symbol: "Crypto.ETH/USD",
};

const bkng: TestFeed = {
  cmc_id: null,
  description: "Booking Holdings Inc.",
  hermes_id: null,
  name: "Booking Holdings",
  nasdaq_symbol: "BKNG",
  pyth_lazer_id: 100,
  symbol: "Equity.US.BKNG/USD",
};

// A decoy feed whose hermes_id happens to contain the digit "1" as a substring
// (nearly every hex hermes_id does). Used to prove pyth_lazer_id=1 wins.
const decoy: TestFeed = {
  cmc_id: null,
  description: "Decoy asset",
  hermes_id: "1111111111111111111111111111111111111111111111111111111111111111",
  name: "FAKE/USD",
  nasdaq_symbol: null,
  pyth_lazer_id: 500,
  symbol: "Crypto.FAKE/USD",
};

const nullish: TestFeed = {
  cmc_id: null,
  description: "Feed with null identifiers",
  hermes_id: null,
  name: "NUL/USD",
  nasdaq_symbol: null,
  pyth_lazer_id: 999,
  symbol: "Crypto.NUL/USD",
};

const allFeeds = [btc, eth, bkng, decoy, nullish];

describe("filterFeedsBySearch", () => {
  it("returns items unchanged when the search string is empty", () => {
    expect(filterFeedsBySearch(allFeeds, "")).toBe(allFeeds);
  });

  it("returns items unchanged when the search string is whitespace only", () => {
    expect(filterFeedsBySearch(allFeeds, "   ")).toStrictEqual(allFeeds);
  });

  it("matches a raw hex hermes_id", () => {
    const result = filterFeedsBySearch(
      allFeeds,
      "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    );
    expect(result.map((f) => f.pyth_lazer_id)).toContain(btc.pyth_lazer_id);
    expect(result[0]).toBe(btc);
  });

  it("matches a hex hermes_id with a 0x prefix", () => {
    const result = filterFeedsBySearch(
      allFeeds,
      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    );
    expect(result[0]).toBe(btc);
  });

  it("matches a hex hermes_id with a 0X (upper-case) prefix", () => {
    const result = filterFeedsBySearch(
      allFeeds,
      "0Xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    );
    expect(result[0]).toBe(btc);
  });

  it("puts an exact pyth_lazer_id match ahead of a hermes_id substring collision (single-term)", () => {
    // Single-term path uses matchSorter, which ranks EQUAL matches (btc's
    // pyth_lazer_id === '1') above CONTAINS matches (decoy's hermes_id
    // '1111...1111' contains '1').
    const result = filterFeedsBySearch(allFeeds, "1");
    expect(result[0]).toBe(btc);
    expect(result).toContain(decoy);
    expect(result.indexOf(btc)).toBeLessThan(result.indexOf(decoy));
  });

  it("puts an exact pyth_lazer_id match ahead of other matches in the multi-term path", () => {
    // Numeric term "1" → exact pyth_lazer_id match for btc. String term "usd"
    // → substring match for many. btc must come first.
    const result = filterFeedsBySearch(allFeeds, "1 usd");
    expect(result[0]).toBe(btc);
  });

  it("matches a nasdaq_symbol on an equity feed", () => {
    const result = filterFeedsBySearch(allFeeds, "BKNG");
    expect(result).toContain(bkng);
  });

  it("matches a nasdaq_symbol in the multi-term path", () => {
    const result = filterFeedsBySearch(allFeeds, "BKNG, ZZZ");
    expect(result).toContain(bkng);
  });

  it("matches a cmc_id numerically (single-term)", () => {
    const result = filterFeedsBySearch(allFeeds, "1027");
    expect(result.map((f) => f.pyth_lazer_id)).toContain(eth.pyth_lazer_id);
  });

  it("matches a cmc_id numerically in the multi-term path", () => {
    // Two terms → multi-term path. "1027" is only a cmc_id match for ETH.
    const result = filterFeedsBySearch(allFeeds, "1027, ZZZ");
    expect(result).toContain(eth);
  });

  it("supports multi-term OR across mixed identifiers", () => {
    const result = filterFeedsBySearch(allFeeds, "BKNG, 1027");
    expect(result).toContain(bkng);
    expect(result).toContain(eth);
  });

  it("does not blow up on feeds with null hermes_id / nasdaq_symbol / cmc_id", () => {
    // Single-term path
    expect(() => filterFeedsBySearch([nullish], "abc")).not.toThrow();
    // Multi-term path with numeric and string terms
    expect(() => filterFeedsBySearch([nullish], "abc, 42")).not.toThrow();
    // Multi-term hex-ish term (would hit hermes_id branch if not null-guarded)
    expect(() =>
      filterFeedsBySearch([nullish], "0xdeadbeef, foo"),
    ).not.toThrow();
  });

  it("preserves symbol / name / description matching (single-term)", () => {
    expect(filterFeedsBySearch(allFeeds, "BTC")).toContain(btc);
    expect(filterFeedsBySearch(allFeeds, "Ether")).toContain(eth);
    expect(filterFeedsBySearch(allFeeds, "Booking")).toContain(bkng);
  });

  it("preserves exact pyth_lazer_id single-term match", () => {
    const result = filterFeedsBySearch(allFeeds, "2");
    expect(result).toContain(eth);
  });
});
