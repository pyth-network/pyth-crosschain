import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";

const mockFeeds = [
  {
    asset_type: "crypto",
    description: "Bitcoin / USD",
    exponent: -8,
    hermes_id: "0xabc",
    min_channel: "fixed_rate@200ms",
    name: "Bitcoin",
    pyth_lazer_id: 1,
    quote_currency: "USD",
    state: "active",
    symbol: "BTC/USD",
  },
  {
    asset_type: "crypto",
    description: "Ethereum / USD",
    exponent: -8,
    hermes_id: "0xdef",
    min_channel: "fixed_rate@200ms",
    name: "Ethereum",
    pyth_lazer_id: 2,
    quote_currency: "USD",
    state: "active",
    symbol: "ETH/USD",
  },
];

const mockOHLC = {
  c: [51_500, 52_500],
  h: [52_000, 53_000],
  l: [50_000, 51_000],
  o: [51_000, 52_000],
  s: "ok",
  t: [1_708_300_800, 1_708_387_200],
  v: [100, 200],
};

const mockPrice = [
  {
    best_ask_price: 5_100_100_000_000,
    best_bid_price: 5_099_900_000_000,
    channel: "fixed_rate@200ms",
    confidence: 1_000_000,
    exponent: -8,
    price: 5_100_000_000_000,
    price_feed_id: 1,
    publish_time: 1_708_300_800,
    publisher_count: 5,
  },
];

const handlers = [
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(mockFeeds)),
  http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () =>
    HttpResponse.json(mockOHLC),
  ),
  http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, () =>
    HttpResponse.json(mockPrice),
  ),
];

const server = setupServer(...handlers);
const logger = pino({ level: "silent" });

const config = {
  channel: "fixed_rate@200ms",
  historyUrl: HISTORY_URL,
  logLevel: "info" as const,
  requestTimeoutMs: 10_000,
  routerUrl: "https://pyth-lazer.dourolabs.app",
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("HistoryClient", () => {
  const client = new HistoryClient(config, logger);

  describe("getSymbols", () => {
    it("returns feeds", async () => {
      const { data: feeds, upstreamLatencyMs } = await client.getSymbols();
      expect(feeds).toHaveLength(2);
      expect(feeds[0].symbol).toBe("BTC/USD");
      expect(upstreamLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("handles 400 error", async () => {
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () =>
          HttpResponse.json({ error: "bad" }, { status: 400 }),
        ),
      );
      await expect(client.getSymbols()).rejects.toThrow("400");
    });
  });

  describe("getCandlestickData", () => {
    it("returns OHLC data", async () => {
      const { data, upstreamLatencyMs } = await client.getCandlestickData(
        "fixed_rate@200ms",
        "BTC/USD",
        "D",
        1_708_300_800,
        1_708_387_200,
      );
      expect(data.s).toBe("ok");
      expect(data.t).toHaveLength(2);
      expect(upstreamLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getHistoricalPrice", () => {
    it("returns price data", async () => {
      const { data: prices, upstreamLatencyMs } =
        await client.getHistoricalPrice(
          "fixed_rate@200ms",
          [1],
          1_708_300_800_000_000,
        );
      expect(prices).toHaveLength(1);
      expect(prices[0].price_feed_id).toBe(1);
      expect(upstreamLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
