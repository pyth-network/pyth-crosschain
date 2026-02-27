import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import type { SessionContext } from "../../src/server.js";
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

const mockHistoricalPrice = [
  {
    best_ask_price: 5_151_000_000_000,
    best_bid_price: 5_149_000_000_000,
    channel: 3,
    confidence: 500_000,
    exponent: -8,
    price: 5_150_000_000_000,
    price_feed_id: 1,
    publish_time: 1_708_300_800,
    publisher_count: 10,
  },
  {
    best_ask_price: null,
    best_bid_price: null,
    channel: 3,
    confidence: null,
    exponent: null,
    price: 5_140_000_000_000,
    price_feed_id: 1,
    publish_time: 1_708_300_600,
    publisher_count: null,
  },
];

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(mockFeeds)),
  http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.getAll("ids");
    if (ids.length === 0) return new HttpResponse(null, { status: 400 });
    return HttpResponse.json(mockHistoricalPrice);
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

describe("get_historical_price tool", () => {
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

  it("returns enriched prices via symbol lookup", async () => {
    const result = await client.callTool({
      arguments: {
        symbols: ["BTC/USD"],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data).toHaveLength(2);
    expect(data[0].price_feed_id).toBe(1);
    expect(data[0].display_price).toBeDefined();
    expect(data[0].display_bid).toBeDefined();
    expect(data[0].display_ask).toBeDefined();
    // Second entry has null confidence/exponent — no display fields
    expect(data[1].confidence).toBeNull();
    expect(data[1].exponent).toBeNull();
    expect(data[1].display_price).toBeUndefined();
    expect(data[1].display_bid).toBeUndefined();
    expect(data[1].display_ask).toBeUndefined();
  });

  it("returns enriched prices via feed IDs", async () => {
    const result = await client.callTool({
      arguments: {
        price_feed_ids: [1],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data).toHaveLength(2);
    expect(data[0].display_price).toBeDefined();
  });

  it("returns error for unknown symbol", async () => {
    const result = await client.callTool({
      arguments: {
        symbols: ["UNKNOWN/USD"],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Feed not found");
  });

  it("drops symbols when price_feed_ids are provided (IDs take priority)", async () => {
    let symbolsApiCalled = false;
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, () => {
        symbolsApiCalled = true;
        return HttpResponse.json(mockFeeds);
      }),
    );

    const result = await client.callTool({
      arguments: {
        price_feed_ids: [1],
        symbols: ["BTC/USD"],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBeFalsy();
    // symbols should be ignored — getSymbols() should NOT be called
    expect(symbolsApiCalled).toBe(false);
  });

  it("logs numFeedsRequested as deduplicated count", async () => {
    const logLines: string[] = [];
    const dest = new (await import("node:stream")).Writable({
      write(chunk, _encoding, callback) {
        logLines.push(chunk.toString());
        callback();
      },
    });
    const spyLogger = pino({ level: "info" }, dest);

    const config = {
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "info" as const,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    };

    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    const historyClient = new HistoryClient(config, spyLogger);
    const routerClient = new RouterClient(config, spyLogger);
    registerAllTools(
      mcpServer,
      config,
      historyClient,
      routerClient,
      spyLogger,
      createSessionContext(),
    );
    const testClient = await createTestClient(mcpServer);

    const result = await testClient.callTool({
      arguments: {
        // Duplicates: [1,1,2,2,1] should dedup to [1,2] = count 2
        price_feed_ids: [1, 1, 2, 2, 1],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBeFalsy();
    const toolCallLog = logLines
      .map((line) => JSON.parse(line))
      .find(
        (entry: Record<string, unknown>) =>
          entry.tool === "get_historical_price" &&
          entry.event === "tool_call" &&
          entry.status === "success",
      );
    expect(toolCallLog).toBeDefined();
    expect(toolCallLog.num_feeds_requested).toBe(2);
  });

  it("shows future timestamp hint when timestamp is in the future", async () => {
    // Use a far-future timestamp (year ~2040 in seconds)
    const futureTimestamp = Math.floor(Date.now() / 1000) + 500_000_000;

    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, () => {
        // Return empty array to trigger the hint path
        return HttpResponse.json([]);
      }),
    );

    const result = await client.callTool({
      arguments: {
        price_feed_ids: [1],
        timestamp: futureTimestamp,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.hint).toContain("future");
    expect(data.hint).toContain(
      "Historical data is only available for past timestamps",
    );
  });

  it("shows April 2025 hint when past timestamp returns empty", async () => {
    // Use a past timestamp (year 2024)
    const pastTimestamp = 1_700_000_000;

    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, () => {
        return HttpResponse.json([]);
      }),
    );

    const result = await client.callTool({
      arguments: {
        price_feed_ids: [1],
        timestamp: pastTimestamp,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.hint).toContain("April 2025");
    expect(data.hint).not.toContain("future");
  });

  it("returns specific error for nonexistent feed ID (400/404)", async () => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/price`, () => {
        return new HttpResponse("Not Found", { status: 404 });
      }),
    );

    const result = await client.callTool({
      arguments: {
        price_feed_ids: [999999],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("999999");
    expect(text).toContain("Verify feed IDs with get_symbols");
  });

  it("returns generic error when getSymbols fails with 400", async () => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, () => {
        return new HttpResponse("Bad Request", { status: 400 });
      }),
    );

    const result = await client.callTool({
      arguments: {
        symbols: ["BTC/USD"],
        timestamp: 1_708_300_800,
      },
      name: "get_historical_price",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    // Should get the generic error, not the feed-specific error
    expect(text).toContain("Failed to fetch historical price");
  });
});
