import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import { registerAllTools } from "../../src/tools/index.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";
const ROUTER_URL = "https://pyth-lazer.dourolabs.app";

const mockFeeds = [
  {
    asset_type: "crypto",
    description: "Bitcoin / USD",
    exponent: -8,
    hermes_id: null,
    min_channel: "fixed_rate@200ms",
    name: "Bitcoin",
    pyth_lazer_id: 1,
    quote_currency: "USD",
    state: "active",
    symbol: "BTC/USD",
  },
];

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(mockFeeds)),
  http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () =>
    HttpResponse.json({
      c: [51_500, 52_000],
      h: [52_000, 52_500],
      l: [50_000, 50_500],
      o: [51_000, 51_500],
      s: "ok",
      t: [1_708_300_800, 1_708_387_200],
      v: [100, 150],
    }),
  ),
);

const logger = pino({ level: "silent" });

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

describe("get_candlestick_data tool", () => {
  let client: Client;

  beforeAll(async () => {
    const config = {
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "info" as const,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    };

    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    const historyClient = new HistoryClient(config, logger);
    const routerClient = new RouterClient(config, logger);
    registerAllTools(mcpServer, config, historyClient, routerClient, logger);
    client = await createTestClient(mcpServer);
  });

  it("returns OHLC data for valid request", async () => {
    const result = await client.callTool({
      arguments: {
        from: 1_708_300_800,
        resolution: "D",
        symbol: "BTC/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.s).toBe("ok");
    expect(data.t).toHaveLength(2);
  });

  it("returns tool error for no_data response", async () => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () =>
        HttpResponse.json({
          c: [],
          h: [],
          l: [],
          o: [],
          s: "no_data",
          t: [],
          v: [],
        }),
      ),
    );

    const result = await client.callTool({
      arguments: {
        from: 1_708_300_800,
        resolution: "D",
        symbol: "BTC/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("No candlestick data");
  });

  it("truncates results beyond 500 candles", async () => {
    const bigData = {
      c: Array.from({ length: 600 }, () => 51_500),
      h: Array.from({ length: 600 }, () => 52_000),
      l: Array.from({ length: 600 }, () => 50_000),
      o: Array.from({ length: 600 }, () => 51_000),
      s: "ok",
      t: Array.from({ length: 600 }, (_, i) => 1_708_300_800 + i * 86_400),
      v: Array.from({ length: 600 }, () => 100),
    };

    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () =>
        HttpResponse.json(bigData),
      ),
    );

    const result = await client.callTool({
      arguments: {
        from: 1_708_300_800,
        resolution: "1",
        symbol: "BTC/USD",
        to: 1_760_000_000,
      },
      name: "get_candlestick_data",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.truncated).toBe(true);
    expect(data.returned).toBe(500);
    expect(data.total_available).toBe(600);
    expect(data.t).toHaveLength(500);
  });
});
