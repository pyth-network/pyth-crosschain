import type { HistoryClient } from "../../src/clients/history.js";
import type { RouterClient } from "../../src/clients/router.js";
import type { Config } from "../../src/config.js";
import { createBindings } from "../../src/codemode/bindings.js";
import pino from "pino";

describe("Code Mode bindings — token injection", () => {
  const logger = pino({ level: "silent" });

  const mockHistoryClient = {
    getSymbols: async () => ({ data: [], upstreamLatencyMs: 0 }),
    getHistoricalPrice: async () => ({ data: [], upstreamLatencyMs: 0 }),
    getCandlestickData: async () => ({ data: { s: "ok", t: [], o: [], h: [], l: [], c: [], v: [] }, upstreamLatencyMs: 0 }),
  } as unknown as HistoryClient;

  const mockRouterClient = {
    getLatestPrice: async (
      token: string,
      symbols?: string[],
      priceFeedIds?: number[],
    ) => {
      expect(token).toBe("injected-token");
      expect(priceFeedIds).toEqual([1]);
      return {
        data: [
          {
            price_feed_id: 1,
            timestamp_us: Date.now() * 1000,
            price: 50_000_000_000,
            exponent: -8,
          },
        ],
        upstreamLatencyMs: 10,
      };
    },
  } as unknown as RouterClient;

  const config = {
    channel: "fixed_rate@200ms",
    historyUrl: "https://history.example.com",
    logLevel: "info" as const,
    requestTimeoutMs: 10_000,
    routerUrl: "https://router.example.com",
  } as Config;

  it("get_latest_price receives injected token, never from model input", async () => {
    const bindings = createBindings({
      config,
      historyClient: mockHistoryClient,
      logger,
      routerClient: mockRouterClient,
      serverToken: "injected-token",
    });

    const result = await bindings.get_latest_price({
      price_feed_ids: [1],
      symbols: undefined,
    });

    expect(result).toHaveLength(1);
    expect(result[0].price_feed_id).toBe(1);
  });

  it("get_latest_price throws when server token not configured", async () => {
    const bindings = createBindings({
      config,
      historyClient: mockHistoryClient,
      logger,
      routerClient: mockRouterClient,
      serverToken: undefined,
    });

    await expect(
      bindings.get_latest_price({ price_feed_ids: [1] }),
    ).rejects.toThrow("Server is not configured with a Pyth Pro access token");
  });

  it("get_symbols does not receive or use token", async () => {
    const bindings = createBindings({
      config,
      historyClient: mockHistoryClient,
      logger,
      routerClient: mockRouterClient,
      serverToken: "irrelevant",
    });

    const result = await bindings.get_symbols({ query: "BTC" });
    expect(result).toHaveProperty("feeds");
    expect(result.feeds).toEqual([]);
  });
});
