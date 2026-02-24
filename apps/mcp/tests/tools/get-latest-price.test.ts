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

const mockLatestPrice = {
  leUnsigned: { data: "deadbeef", encoding: "base64" },
  parsed: {
    priceFeeds: [
      {
        bestAskPrice: "9742360000000",
        bestBidPrice: "9742340000000",
        confidence: "100000",
        exponent: -8,
        price: "9742350000000",
        priceFeedId: 1,
        publisherCount: 5,
      },
    ],
    timestampUs: "1708300800000000",
  },
};

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(mockFeeds)),
  http.post(`${ROUTER_URL}/v1/latest_price`, () =>
    HttpResponse.json(mockLatestPrice),
  ),
);

const logger = pino({ level: "silent" });

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

describe("get_latest_price tool", () => {
  it("returns auth error when no access_token", async () => {
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

    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: { symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("access token");
    expect(text).toContain("access_token");
    expect(text).toContain("pyth.network/pricing");
  });

  it("returns price with display_price when access_token provided", async () => {
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

    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: { access_token: "test-token", symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data).toHaveLength(1);
    expect(data[0].price_feed_id).toBe(1);
    expect(data[0].display_price).toBeCloseTo(97_423.5, 2);
    expect(data[0].evm).toBeUndefined();
    expect(data[0].solana).toBeUndefined();
  });
});
