import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import { loadConfig } from "../../src/config.js";
import type { SessionContext } from "../../src/server.js";
import { registerAllTools } from "../../src/tools/index.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";

const mockFeeds = Array.from({ length: 100 }, (_, i) => ({
  asset_type: i < 50 ? "crypto" : "equity",
  description: `Feed ${i} / USD`,
  exponent: -8,
  hermes_id: null,
  min_channel: "fixed_rate@200ms",
  name: `Feed${i}`,
  pyth_lazer_id: i + 1,
  quote_currency: "USD",
  state: "active",
  symbol: `FEED${i}/USD`,
}));

mockFeeds.push(
  {
    asset_type: "crypto",
    description: "Bitcoin / US Dollar",
    exponent: -8,
    hermes_id: "0xabc",
    min_channel: "fixed_rate@200ms",
    name: "Bitcoin",
    pyth_lazer_id: 200,
    quote_currency: "USD",
    state: "active",
    symbol: "BTC/USD",
  },
  {
    asset_type: "equity",
    description: "Apple Inc. / US Dollar",
    exponent: -8,
    hermes_id: null,
    min_channel: "fixed_rate@200ms",
    name: "Apple Inc.",
    pyth_lazer_id: 201,
    quote_currency: "USD",
    state: "active",
    symbol: "Equity.US.AAPL/USD",
  },
);

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
    const url = new URL(request.url);
    // query filtering is now client-side; assert it's never sent upstream
    if (url.searchParams.has("query")) {
      return new HttpResponse("query param must not be sent upstream", {
        status: 400,
      });
    }
    const assetType = url.searchParams.get("asset_type");
    let filtered = mockFeeds;
    if (assetType) {
      filtered = filtered.filter((f) => f.asset_type === assetType);
    }
    return HttpResponse.json(filtered);
  }),
);

const logger = pino({ level: "silent" });

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

function createSessionContext(): SessionContext {
  return {
    serverVersion: "0.0.1",
    sessionId: "test-session-id",
    sessionStartTime: Date.now(),
    toolCallCount: 0,
  };
}

describe("get_symbols tool", () => {
  let client: Client;

  beforeAll(async () => {
    const config = loadConfig();
    const historyClient = new HistoryClient(config, logger);
    const routerClient = new RouterClient(config, logger);

    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    registerAllTools(
      mcpServer,
      config,
      historyClient,
      routerClient,
      logger,
      createSessionContext(),
    );
    client = await createTestClient(mcpServer);
  });

  it("returns paginated results with defaults", async () => {
    const result = await client.callTool({
      arguments: {},
      name: "get_symbols",
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    const data = JSON.parse(text);

    expect(data.count).toBe(50);
    expect(data.total_available).toBe(102);
    expect(data.has_more).toBe(true);
    expect(data.offset).toBe(0);
    expect(data.next_offset).toBe(50);
  });

  it("filters by query", async () => {
    const result = await client.callTool({
      arguments: { query: "Bitcoin" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(
      data.feeds.some((f: { symbol: string }) => f.symbol === "BTC/USD"),
    ).toBe(true);
  });

  it("filters by asset_type", async () => {
    const result = await client.callTool({
      arguments: { asset_type: "equity" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(
      data.feeds.every(
        (f: { asset_type: string }) => f.asset_type === "equity",
      ),
    ).toBe(true);
  });

  it("paginates with offset and limit", async () => {
    const result = await client.callTool({
      arguments: { limit: 20, offset: 90 },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.count).toBe(12);
    expect(data.has_more).toBe(false);
    expect(data.next_offset).toBeNull();
  });

  it("matches query against name (client-side)", async () => {
    const result = await client.callTool({
      arguments: { query: "apple" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.feeds).toHaveLength(1);
    expect(data.feeds[0].symbol).toBe("Equity.US.AAPL/USD");
  });

  it("matches query against symbol (client-side)", async () => {
    const result = await client.callTool({
      arguments: { query: "AAPL" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.feeds).toHaveLength(1);
    expect(data.feeds[0].name).toBe("Apple Inc.");
  });

  it("combines server-side asset_type with client-side query", async () => {
    const result = await client.callTool({
      arguments: { asset_type: "equity", query: "apple" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.feeds).toHaveLength(1);
    expect(data.feeds[0].symbol).toBe("Equity.US.AAPL/USD");
  });

  it("treats whitespace-only query as no filter", async () => {
    const result = await client.callTool({
      arguments: { query: "  " },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.total_available).toBe(102);
  });

  it("paginates after client-side filtering", async () => {
    const result = await client.callTool({
      arguments: { limit: 5, offset: 0, query: "Feed1" },
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    // Feed1, Feed10-Feed19 = 11 feeds match "Feed1"
    expect(data.total_available).toBe(11);
    expect(data.count).toBe(5);
    expect(data.has_more).toBe(true);
    expect(data.next_offset).toBe(5);
  });
});
