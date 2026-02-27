import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import { registerAllResources } from "../../src/resources/index.js";
import { registerAllTools } from "../../src/tools/index.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";
const ROUTER_URL = "https://pyth-lazer.dourolabs.app";

const mockFeeds = [
  {
    asset_type: "crypto",
    description: "Bitcoin / US Dollar",
    exponent: -8,
    hermes_id: "0xabc",
    market_sessions: {
      regular: { min_pub: null, schedule: "America/New_York;O,O,O,O,O,O,O;" },
    },
    min_channel: "fixed_rate@200ms",
    name: "Bitcoin",
    pyth_lazer_id: 1,
    quote_currency: "USD",
    state: "active",
    symbol: "BTC/USD",
  },
  {
    asset_type: "crypto",
    description: "Ethereum / US Dollar",
    exponent: -8,
    hermes_id: "0xdef",
    market_sessions: {
      regular: { min_pub: null, schedule: "America/New_York;O,O,O,O,O,O,O;" },
    },
    min_channel: "fixed_rate@200ms",
    name: "Ethereum",
    pyth_lazer_id: 2,
    quote_currency: "USD",
    state: "active",
    symbol: "ETH/USD",
  },
  {
    asset_type: "metal",
    description: "Gold / US Dollar",
    exponent: -5,
    hermes_id: null,
    market_sessions: {
      regular: { min_pub: null, schedule: "America/New_York;O,O,O,O,O,O,O;" },
    },
    min_channel: "fixed_rate@200ms",
    name: "Gold",
    pyth_lazer_id: 10,
    quote_currency: "USD",
    state: "active",
    symbol: "XAU/USD",
  },
];

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
    const url = new URL(request.url);
    const assetType = url.searchParams.get("asset_type");
    if (assetType) {
      return HttpResponse.json(
        mockFeeds.filter((f) => f.asset_type === assetType),
      );
    }
    return HttpResponse.json(mockFeeds);
  }),
  http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () =>
    HttpResponse.json({
      c: [51_500],
      h: [52_000],
      l: [50_000],
      o: [51_000],
      s: "ok",
      t: [1_708_300_800],
      v: [100],
    }),
  ),
  http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, () =>
    HttpResponse.json([
      {
        best_ask_price: 5_151_000_000_000,
        best_bid_price: 5_149_000_000_000,
        channel: "fixed_rate@200ms",
        confidence: 500_000,
        exponent: -8,
        price: 5_150_000_000_000,
        price_feed_id: 1,
        publish_time: 1_708_300_800,
        publisher_count: 10,
      },
    ]),
  ),
  http.post(`${ROUTER_URL}/v1/latest_price`, () =>
    HttpResponse.json({
      leUnsigned: { data: "deadbeef", encoding: "base64" },
      parsed: {
        priceFeeds: [
          {
            exponent: -8,
            price: "5200000000000",
            priceFeedId: 1,
          },
        ],
        timestampUs: "1708300800000000",
      },
    }),
  ),
);

const logger = pino({ level: "silent" });

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

describe("Integration: MCP server round-trip", () => {
  let client: Client;

  beforeAll(async () => {
    const config = {
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "info" as const,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    };

    const mcpServer = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });
    const historyClient = new HistoryClient(config, logger);
    const routerClient = new RouterClient(config, logger);

    registerAllTools(mcpServer, config, historyClient, routerClient, logger);
    registerAllResources(mcpServer, historyClient);

    client = await createTestClient(mcpServer);
  });

  it("lists available tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("get_symbols");
    expect(names).toContain("get_candlestick_data");
    expect(names).toContain("get_historical_price");
    expect(names).toContain("get_latest_price");
    expect(names).toHaveLength(4);
  });

  it("all tools have readOnlyHint annotation", async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("get_symbols returns feeds", async () => {
    const result = await client.callTool({
      arguments: { query: "BTC" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.feeds[0].symbol).toBe("BTC/USD");
  });

  it("get_candlestick_data returns OHLC", async () => {
    const result = await client.callTool({
      arguments: {
        from: 1_708_300_800,
        resolution: "D",
        symbol: "BTC/USD",
        to: 1_708_387_200,
      },
      name: "get_candlestick_data",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.s).toBe("ok");
    expect(data.t).toHaveLength(1);
  });

  it("get_historical_price resolves symbols to IDs", async () => {
    const result = await client.callTool({
      arguments: {
        symbols: ["BTC/USD"],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data[0].display_price).toBeDefined();
  });

  it("get_latest_price returns enriched data", async () => {
    const result = await client.callTool({
      arguments: { access_token: "test-token", symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data[0].display_price).toBeDefined();
    expect(data[0].evm).toBeUndefined();
  });

  it("lists resources", async () => {
    const result = await client.listResources();
    const uris = result.resources.map((r) => r.uri);
    expect(uris).toContain("pyth://feeds");
  });

  it("reads pyth://feeds resource", async () => {
    const result = await client.readResource({ uri: "pyth://feeds" });
    const feeds = JSON.parse(result.contents[0].text as string);
    expect(feeds).toHaveLength(3);
  });

  it("reads pyth://feeds/crypto resource", async () => {
    const result = await client.readResource({ uri: "pyth://feeds/crypto" });
    const feeds = JSON.parse(result.contents[0].text as string);
    expect(
      feeds.every((f: { asset_type: string }) => f.asset_type === "crypto"),
    ).toBe(true);
    expect(feeds).toHaveLength(2);
  });

  it("reads pyth://feeds/metal resource", async () => {
    const result = await client.readResource({ uri: "pyth://feeds/metal" });
    const feeds = JSON.parse(result.contents[0].text as string);
    expect(feeds).toHaveLength(1);
    expect(feeds[0].symbol).toBe("XAU/USD");
  });
});

describe("Integration: auth gating", () => {
  it("get_latest_price returns error without access_token, other tools work", async () => {
    const config = {
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "info" as const,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    };

    const mcpServer = new McpServer({
      name: "test-no-token",
      version: "0.0.1",
    });
    const historyClient = new HistoryClient(config, logger);
    const routerClient = new RouterClient(config, logger);

    registerAllTools(mcpServer, config, historyClient, routerClient, logger);

    const client = await createTestClient(mcpServer);

    // get_symbols should work without token
    const symbolsResult = await client.callTool({
      arguments: {},
      name: "get_symbols",
    });
    expect(symbolsResult.isError).toBeFalsy();

    // get_latest_price should return auth error
    const priceResult = await client.callTool({
      arguments: { symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });
    expect(priceResult.isError).toBe(true);
  });
});
