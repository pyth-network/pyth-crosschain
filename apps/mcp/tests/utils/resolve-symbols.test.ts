import type { Feed } from "../../src/clients/types.js";
import {
  resolvedSymbolsField,
  resolveSymbols,
} from "../../src/utils/resolve-symbols.js";

function feed(
  id: number,
  symbol: string,
  state = "stable",
  instrument_type = "spot",
): Feed {
  return {
    asset_type: "crypto",
    description: symbol,
    exponent: -8,
    hermes_id: null,
    instrument_type,
    min_channel: "fixed_rate@200ms",
    name: symbol,
    pyth_lazer_id: id,
    quote_currency: "USD",
    state,
    symbol,
  };
}

// Shapes taken from the live catalog.
const catalog: Feed[] = [
  feed(1, "Crypto.BTC/USD"),
  feed(10, "FundingRate.Deribit.8h.BTC/USD", "stable", "rate"),
  feed(11, "FundingRate.Hyperliquid.BTC/USD", "stable", "rate"),
  feed(922, "Equity.US.AAPL/USD"),
  feed(923, "Equity.Index.AAPL/USD", "stable", "index"),
  feed(924, "Pyth.XS.AAPL/USD", "coming_soon"),
  feed(112, "FundingRate.Binance.BTC/USDT", "stable", "rate"),
  feed(113, "FundingRate.Bybit.BTC/USDT", "coming_soon", "rate"),
  feed(200, "Crypto.OLD/USD", "inactive"),
  feed(300, "FX.EUR/USD"),
  feed(301, "FX.Index.EUR/USD", "stable", "index"),
  feed(400, "Crypto.Index.FOO/USD", "stable", "index"),
  feed(401, "Equity.Index.FOO/USD", "stable", "index"),
];

const ids = (inputs: string[]) =>
  resolveSymbols(inputs, catalog).feeds.map((f) => f.pyth_lazer_id);

describe("resolveSymbols", () => {
  it("matches full symbols exactly without reporting a resolution", () => {
    const r = resolveSymbols(["Crypto.BTC/USD"], catalog);
    expect(r.feeds.map((f) => f.pyth_lazer_id)).toEqual([1]);
    expect(r.resolved).toEqual({});
  });

  it("matches case-insensitively", () => {
    const r = resolveSymbols(["crypto.btc/usd"], catalog);
    expect(r.feeds[0]?.pyth_lazer_id).toBe(1);
    expect(r.resolved).toEqual({ "crypto.btc/usd": "Crypto.BTC/USD" });
  });

  it("resolves a bare pair to the single live spot feed", () => {
    expect(ids(["BTC/USD"])).toEqual([1]);
    expect(ids(["AAPL/USD"])).toEqual([922]);
    expect(ids(["EUR/USD"])).toEqual([300]);
    expect(resolveSymbols(["BTC/USD"], catalog).resolved).toEqual({
      "BTC/USD": "Crypto.BTC/USD",
    });
  });

  it("prefers live feeds over coming_soon when there is no spot feed", () => {
    expect(ids(["BTC/USDT"])).toEqual([112]);
  });

  it("never resolves a bare pair to an inactive feed", () => {
    const r = resolveSymbols(["OLD/USD"], catalog);
    expect(r.feeds).toEqual([]);
    expect(r.errors[0]).toContain(
      "OLD/USD only matches retired (inactive) feeds: Crypto.OLD/USD",
    );
  });

  it("still resolves an inactive feed named in full", () => {
    expect(ids(["Crypto.OLD/USD"])).toEqual([200]);
  });

  it("reports ambiguous inputs with their candidates", () => {
    const r = resolveSymbols(["FOO/USD"], catalog);
    expect(r.errors[0]).toContain("Ambiguous symbol: FOO/USD");
    expect(r.errors[0]).toContain("Crypto.Index.FOO/USD");
    expect(r.errors[0]).toContain("Equity.Index.FOO/USD");
  });

  it("does not treat a substring as a match", () => {
    expect(resolveSymbols(["TC/USD"], catalog).errors).toHaveLength(1);
  });

  it("collects one error per unresolved input and keeps order", () => {
    const r = resolveSymbols(["AAPL/USD", "NOPE/USD", "BTC/USD"], catalog);
    expect(r.errors).toHaveLength(1);
    expect(r.feeds.map((f) => f.pyth_lazer_id)).toEqual([922, 1]);
  });
});

describe("resolvedSymbolsField", () => {
  it("is omitted when nothing was resolved", () => {
    expect(resolvedSymbolsField({})).toEqual({});
  });

  it("wraps resolutions", () => {
    expect(resolvedSymbolsField({ "BTC/USD": "Crypto.BTC/USD" })).toEqual({
      resolved_symbols: { "BTC/USD": "Crypto.BTC/USD" },
    });
  });
});
