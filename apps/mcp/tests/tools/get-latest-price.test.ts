import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import { clearSymbolsCache } from "../../src/clients/symbols-store.js";
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
afterEach(() => {
  msw.resetHandlers();
  clearSymbolsCache();
});
afterAll(() => msw.close());

function createSessionContext(): SessionContext {
  return {
    serverVersion: "0.0.1",
    sessionId: "test-session-id",
    sessionStartTime: Date.now(),
    toolCallCount: 0,
  };
}

describe("get_latest_price tool", () => {
  it("returns validation error when no access_token", async () => {
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

    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: { symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });

    expect(result.isError).toBe(true);
  });

  it("accepts 100 price_feed_ids + extra symbols (symbols are dropped)", async () => {
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

    const client = await createTestClient(mcpServer);
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = await client.callTool({
      arguments: {
        access_token: "test-token",
        price_feed_ids: ids,
        symbols: ["BTC/USD", "ETH/USD"],
      },
      name: "get_latest_price",
    });

    // Should NOT fail validation — symbols are ignored when price_feed_ids are present
    expect(result.isError).toBeFalsy();
  });

  it("rejects empty access_token", async () => {
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

    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: { access_token: "", symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });

    expect(result.isError).toBe(true);
  });

  it("rejects whitespace-only access_token", async () => {
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

    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: { access_token: "   ", symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });

    expect(result.isError).toBe(true);
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
    registerAllTools(
      mcpServer,
      config,
      historyClient,
      routerClient,
      logger,
      createSessionContext(),
    );

    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: { access_token: "test-token", symbols: ["BTC/USD"] },
      name: "get_latest_price",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.prices).toHaveLength(1);
    expect(data.server_time_utc).toBeDefined();
    expect(data.server_unix_seconds).toBeDefined();
    expect(data.prices[0].price_feed_id).toBe(1);
    expect(data.prices[0].display_price).toBeCloseTo(97_423.5, 2);
    expect(data.prices[0].evm).toBeUndefined();
    expect(data.prices[0].solana).toBeUndefined();
  });

  describe("PYTH_PRO_ACCESS_TOKEN fallback", () => {
    async function callWith(
      configToken: string | undefined,
      args: Record<string, unknown>,
    ) {
      let authHeader: string | null = null;
      msw.use(
        http.post(`${ROUTER_URL}/v1/latest_price`, ({ request }) => {
          authHeader = request.headers.get("Authorization");
          return HttpResponse.json(mockLatestPrice);
        }),
      );
      const config = {
        accessToken: configToken,
        channel: "fixed_rate@200ms",
        historyUrl: HISTORY_URL,
        logLevel: "info" as const,
        requestTimeoutMs: 10_000,
        routerUrl: ROUTER_URL,
      };
      const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
      registerAllTools(
        mcpServer,
        config,
        new HistoryClient(config, logger),
        new RouterClient(config, logger),
        logger,
        createSessionContext(),
      );
      const client = await createTestClient(mcpServer);
      const result = await client.callTool({
        arguments: args,
        name: "get_latest_price",
      });
      return { authHeader, result };
    }

    it("uses the env key when no access_token is passed", async () => {
      const { authHeader, result } = await callWith("env-key", {
        price_feed_ids: [1],
      });
      expect(result.isError).toBeFalsy();
      expect(authHeader).toBe("Bearer env-key");
    });

    it("prefers a per-call access_token over the env key", async () => {
      const { authHeader, result } = await callWith("env-key", {
        access_token: "per-call-key",
        price_feed_ids: [1],
      });
      expect(result.isError).toBeFalsy();
      expect(authHeader).toBe("Bearer per-call-key");
    });

    it("returns the missing-token message when neither is set", async () => {
      const { authHeader, result } = await callWith(undefined, {
        price_feed_ids: [1],
      });
      expect(result.isError).toBe(true);
      expect(authHeader).toBeNull();
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      expect(text).toContain("PYTH_PRO_ACCESS_TOKEN");
    });
  });

  describe("upstream auth errors", () => {
    async function callWithUpstream(status: number, body: string | null) {
      msw.use(
        http.post(
          `${ROUTER_URL}/v1/latest_price`,
          () => new HttpResponse(body, { status }),
        ),
      );
      const config = {
        channel: "fixed_rate@200ms",
        historyUrl: HISTORY_URL,
        logLevel: "info" as const,
        requestTimeoutMs: 10_000,
        routerUrl: ROUTER_URL,
      };
      const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
      registerAllTools(
        mcpServer,
        config,
        new HistoryClient(config, logger),
        new RouterClient(config, logger),
        logger,
        createSessionContext(),
      );
      const client = await createTestClient(mcpServer);
      const result = await client.callTool({
        arguments: { access_token: "some-token", price_feed_ids: [3063] },
        name: "get_latest_price",
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      return { result, text };
    }

    it("maps 401 to the invalid-token message", async () => {
      const { result, text } = await callWithUpstream(401, null);
      expect(result.isError).toBe(true);
      expect(text).toContain("invalid or expired");
    });

    it("maps 403 to the not-entitled message with the upstream reason", async () => {
      const { result, text } = await callWithUpstream(
        403,
        'Not entitled: feed 3063 (it requires access to one of the following groups: ["pyth-indices"])',
      );
      expect(result.isError).toBe(true);
      expect(text).toContain("not entitled");
      expect(text).toContain("pyth-indices");
      expect(text).not.toContain("invalid or expired");
    });
  });
});
