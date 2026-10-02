import { addDisplayPrices } from "../../src/utils/display-price.js";

describe("addDisplayPrices", () => {
  it("computes display_price from price and exponent", () => {
    // BTC at $97,423.50: raw = 9742350000000, exponent = -8
    const feed = { exponent: -8, price: 9_742_350_000_000 };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBeCloseTo(97_423.5, 2);
  });

  it("computes display_bid and display_ask", () => {
    const feed = {
      best_ask_price: 9_742_360_000_000,
      best_bid_price: 9_742_340_000_000,
      exponent: -8,
      price: 9_742_350_000_000,
    };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBeCloseTo(97_423.5, 2);
    expect(result.display_bid).toBeCloseTo(97_423.4, 2);
    expect(result.display_ask).toBeCloseTo(97_423.6, 2);
  });

  it("omits display fields when price is null", () => {
    const feed = { exponent: -8, price: null };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBeUndefined();
  });

  it("omits display fields when price is undefined", () => {
    const feed = { exponent: -8 };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBeUndefined();
  });

  it("handles exponent of 0", () => {
    const feed = { exponent: 0, price: 100 };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBe(100);
  });

  it("omits display fields when exponent is missing", () => {
    const feed = { price: 42 };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBeUndefined();
  });

  it("omits display fields when exponent is null", () => {
    const feed = { exponent: null, price: 42 };
    const result = addDisplayPrices(feed);
    expect(result.display_price).toBeUndefined();
  });

  it("computes display values for confidence, EMA and funding rate", () => {
    const feed = {
      confidence: 5007,
      ema_confidence: 2972,
      ema_price: 33_349_628,
      exponent: -5,
      funding_rate: 1214,
    };
    const result = addDisplayPrices(feed);
    expect(result.display_confidence).toBeCloseTo(0.050_07, 8);
    expect(result.display_ema_price).toBeCloseTo(333.496_28, 8);
    expect(result.display_ema_confidence).toBeCloseTo(0.029_72, 8);
    expect(result.display_funding_rate).toBeCloseTo(0.012_14, 8);
  });

  it("uses the feed exponent for funding rates (live example)", () => {
    const feed = { exponent: -12, funding_rate: 12_140_000 };
    expect(addDisplayPrices(feed).display_funding_rate).toBeCloseTo(
      1.214e-5,
      12,
    );
  });

  it("omits display fields for null values", () => {
    const result = addDisplayPrices({
      ema_price: null,
      exponent: -8,
      funding_rate: null,
    });
    expect(result.display_ema_price).toBeUndefined();
    expect(result.display_funding_rate).toBeUndefined();
  });
});
