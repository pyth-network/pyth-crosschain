import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { clearSymbolsCache } from "../../src/clients/symbols-store.js";

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
afterEach(() => {
  server.resetHandlers();
  clearSymbolsCache();
});
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

    it("serves repeat calls from the cache", async () => {
      let calls = 0;
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () => {
          calls++;
          return HttpResponse.json(mockFeeds);
        }),
      );
      await client.getSymbols();
      const second = await client.getSymbols();
      expect(calls).toBe(1);
      expect(second.data).toHaveLength(2);
      expect(second.upstreamLatencyMs).toBe(0);
    });

    it("caches per token and sends the token as a Bearer header", async () => {
      const seen: Array<string | null> = [];
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
          seen.push(request.headers.get("Authorization"));
          return HttpResponse.json(mockFeeds);
        }),
      );
      await client.getSymbols();
      await client.getSymbols("token-a");
      await client.getSymbols("token-a");
      await client.getSymbols("token-b");
      expect(seen).toEqual([null, "Bearer token-a", "Bearer token-b"]);
    });

    it("does not remember a 4xx failure", async () => {
      let calls = 0;
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () => {
          calls++;
          return calls === 1
            ? HttpResponse.json({ error: "bad" }, { status: 400 })
            : HttpResponse.json(mockFeeds);
        }),
      );
      await expect(client.getSymbols()).rejects.toThrow("400");
      const { data } = await client.getSymbols();
      expect(data).toHaveLength(2);
      expect(calls).toBe(2);
    });

    it("remembers an outage briefly instead of calling History again", async () => {
      let calls = 0;
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () => {
          calls++;
          return HttpResponse.json({ error: "down" }, { status: 500 });
        }),
      );
      await expect(client.getSymbols()).rejects.toThrow("500");
      await expect(client.getSymbols()).rejects.toThrow("500");
      expect(calls).toBe(1);
    });

    it("drops a feed that does not match the schema and keeps the rest", async () => {
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () =>
          HttpResponse.json([
            ...mockFeeds,
            { pyth_lazer_id: 99, symbol: "Crypto.BROKEN/USD" },
          ]),
        ),
      );
      const { data } = await client.getSymbols();
      expect(data.map((f) => f.pyth_lazer_id)).toEqual([1, 2]);
    });

    it("accepts feeds without hermes_id or quote_currency", async () => {
      const { hermes_id: _h, quote_currency: _q, ...bare } = mockFeeds[0];
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json([bare])),
      );
      const { data } = await client.getSymbols();
      expect(data).toHaveLength(1);
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

    it("accepts price: null (no publisher at that time)", async () => {
      // Verified live: e.g. Pyth.BN.AMD/USDT returns price null with
      // publisher_count 0.
      server.use(
        http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, () =>
          HttpResponse.json([
            ...mockPrice,
            {
              ...mockPrice[0],
              price: null,
              price_feed_id: 99_025,
              publisher_count: 0,
            },
          ]),
        ),
      );
      const { data } = await client.getHistoricalPrice(
        "fixed_rate@200ms",
        [1, 99_025],
        1_708_300_800_000_000,
      );
      expect(data.map((p) => p.price)).toEqual([5_100_000_000_000, null]);
    });
  });

  describe("authentication", () => {
    it("sends Authorization: Bearer on getCandlestickData when a token is set", async () => {
      let authHeader: string | null = "unset";
      server.use(
        http.get(
          `${HISTORY_URL}/v1/fixed_rate@200ms/history`,
          ({ request }) => {
            authHeader = request.headers.get("authorization");
            return HttpResponse.json(mockOHLC);
          },
        ),
      );
      await client.getCandlestickData(
        "fixed_rate@200ms",
        "BTC/USD",
        "D",
        1_708_300_800,
        1_708_387_200,
        "secret-token",
      );
      expect(authHeader).toBe("Bearer secret-token");
    });

    it("sends Authorization: Bearer on getHistoricalPrice when a token is set", async () => {
      let authHeader: string | null = "unset";
      server.use(
        http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, ({ request }) => {
          authHeader = request.headers.get("authorization");
          return HttpResponse.json(mockPrice);
        }),
      );
      await client.getHistoricalPrice(
        "fixed_rate@200ms",
        [1],
        1_708_300_800_000_000,
        "secret-token",
      );
      expect(authHeader).toBe("Bearer secret-token");
    });

    it("omits the Authorization header when no token is passed", async () => {
      let priceAuth: string | null = "unset";
      let ohlcAuth: string | null = "unset";
      server.use(
        http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, ({ request }) => {
          priceAuth = request.headers.get("authorization");
          return HttpResponse.json(mockPrice);
        }),
        http.get(
          `${HISTORY_URL}/v1/fixed_rate@200ms/history`,
          ({ request }) => {
            ohlcAuth = request.headers.get("authorization");
            return HttpResponse.json(mockOHLC);
          },
        ),
      );
      await client.getHistoricalPrice(
        "fixed_rate@200ms",
        [1],
        1_708_300_800_000_000,
      );
      await client.getCandlestickData(
        "fixed_rate@200ms",
        "BTC/USD",
        "D",
        1_708_300_800,
        1_708_387_200,
      );
      expect(priceAuth).toBeNull();
      expect(ohlcAuth).toBeNull();
    });

    it("never sends an Authorization header on the public getSymbols endpoint", async () => {
      let authHeader: string | null = "unset";
      server.use(
        http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
          authHeader = request.headers.get("authorization");
          return HttpResponse.json(mockFeeds);
        }),
      );
      await client.getSymbols();
      expect(authHeader).toBeNull();
    });
  });
});
