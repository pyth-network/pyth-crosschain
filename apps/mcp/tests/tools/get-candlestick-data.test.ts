import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
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

  it("returns OHLC data for valid request", async () => {
    const result = await client.callTool({
      arguments: {
        access_token: "test-token",
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
    expect(data.server_time_utc).toBeDefined();
    expect(data.server_unix_seconds).toBeDefined();
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
        access_token: "test-token",
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
    expect(text).toContain("BTC/USD");
    // ISO echo should be present
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}T/);
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
        access_token: "test-token",
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

  it("forwards access_token as a Bearer header to the history endpoint", async () => {
    let authHeader: string | null = "unset";
    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, ({ request }) => {
        authHeader = request.headers.get("authorization");
        return HttpResponse.json({
          c: [51_500],
          h: [52_000],
          l: [50_000],
          o: [51_000],
          s: "ok",
          t: [1_708_300_800],
          v: [100],
        });
      }),
    );

    const result = await client.callTool({
      arguments: {
        access_token: "pro-token-123",
        from: 1_708_300_800,
        resolution: "D",
        symbol: "BTC/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });

    expect(result.isError).toBeFalsy();
    expect(authHeader).toBe("Bearer pro-token-123");
  });

  it("returns the missing-token message without calling upstream when no token is available", async () => {
    let upstreamCalled = false;
    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () => {
        upstreamCalled = true;
        return new HttpResponse(null, { status: 401 });
      }),
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
    expect(text).toContain("requires your Pyth Pro access token");
    expect(upstreamCalled).toBe(false);
  });

  it("shows Pyth's reason for a 404 instead of 'try again'", async () => {
    // Verified live: a channel faster than the feed's min_channel answers
    // 404 "symbol not found.".
    msw.use(
      http.get(
        `${HISTORY_URL}/v1/fixed_rate@200ms/history`,
        () => new HttpResponse("symbol not found.", { status: 404 }),
      ),
    );
    const result = await client.callTool({
      arguments: {
        access_token: "test-token",
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
    expect(text).toContain("(404): symbol not found. Check");
    expect(text).toContain("min_channel");
    expect(text).not.toMatch(/try again/i);
  });

  it("maps upstream 401 to the invalid-token message", async () => {
    msw.use(
      http.get(
        `${HISTORY_URL}/v1/fixed_rate@200ms/history`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const result = await client.callTool({
      arguments: {
        access_token: "bad-token",
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
    expect(text).toContain("invalid or expired");
  });

  it("maps upstream 403 to the not-entitled message with the upstream reason", async () => {
    msw.use(
      http.get(
        `${HISTORY_URL}/v1/fixed_rate@200ms/history`,
        () =>
          new HttpResponse(
            'Not entitled: feed 3063 (no grant accepts this gated feed; it requires access to one of the following groups: ["pyth-indices"])',
            { status: 403 },
          ),
      ),
    );

    const result = await client.callTool({
      arguments: {
        access_token: "valid-token",
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
    expect(text).toContain("not entitled");
    expect(text).toContain("pyth-indices");
    expect(text).not.toContain("invalid or expired");
  });

  it("resolves a Pro-only symbol with the caller's token", async () => {
    const symbolAuth: Array<string | null> = [];
    let upstreamSymbol: string | null = null;
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
        const auth = request.headers.get("Authorization");
        symbolAuth.push(auth);
        const proOnly = {
          ...mockFeeds[0],
          pyth_lazer_id: 5000,
          state: "stable",
          symbol: "KLP.KXF1/USD",
        };
        return HttpResponse.json(auth ? [...mockFeeds, proOnly] : mockFeeds);
      }),
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, ({ request }) => {
        upstreamSymbol = new URL(request.url).searchParams.get("symbol");
        return HttpResponse.json({
          c: [1],
          h: [1],
          l: [1],
          o: [1],
          s: "ok",
          t: [1_708_300_800],
          v: [1],
        });
      }),
    );
    const result = await client.callTool({
      arguments: {
        access_token: "pro-token",
        from: 1_708_300_800,
        resolution: "D",
        symbol: "KXF1/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });
    expect(result.isError).toBeFalsy();
    expect(symbolAuth).toEqual(["Bearer pro-token"]);
    expect(upstreamSymbol).toBe("KLP.KXF1/USD");
  });

  it("resolves a bare pair to the full symbol before calling upstream", async () => {
    let upstreamSymbol: string | null = null;
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, () =>
        HttpResponse.json([
          {
            ...mockFeeds[0],
            instrument_type: "spot",
            state: "stable",
            symbol: "Crypto.ETH/USD",
          },
          {
            ...mockFeeds[0],
            instrument_type: "rate",
            pyth_lazer_id: 2,
            state: "stable",
            symbol: "FundingRate.Hyperliquid.ETH/USD",
          },
        ]),
      ),
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, ({ request }) => {
        upstreamSymbol = new URL(request.url).searchParams.get("symbol");
        return HttpResponse.json({
          c: [1],
          h: [1],
          l: [1],
          o: [1],
          s: "ok",
          t: [1_708_300_800],
          v: [0],
        });
      }),
    );

    const result = await client.callTool({
      arguments: {
        access_token: "test-token",
        from: 1_708_300_800,
        resolution: "D",
        symbol: "ETH/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });

    expect(result.isError).toBeFalsy();
    expect(upstreamSymbol).toBe("Crypto.ETH/USD");
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.resolved_symbols).toEqual({ "ETH/USD": "Crypto.ETH/USD" });
  });

  it("returns a not-found error for an unknown symbol without calling history", async () => {
    let historyCalled = false;
    msw.use(
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, () => {
        historyCalled = true;
        return HttpResponse.json({});
      }),
    );
    const result = await client.callTool({
      arguments: {
        access_token: "test-token",
        from: 1_708_300_800,
        resolution: "D",
        symbol: "NOPE/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });
    expect(result.isError).toBe(true);
    expect(historyCalled).toBe(false);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Feed not found: NOPE/USD");
  });

  it("uses the symbol as given when the catalog is down", async () => {
    let upstreamSymbol: string | null = null;
    msw.use(
      http.get(
        `${HISTORY_URL}/v1/symbols`,
        () => new HttpResponse(null, { status: 500 }),
      ),
      http.get(`${HISTORY_URL}/v1/fixed_rate@200ms/history`, ({ request }) => {
        upstreamSymbol = new URL(request.url).searchParams.get("symbol");
        return HttpResponse.json({
          c: [1],
          h: [1],
          l: [1],
          o: [1],
          s: "ok",
          t: [1_708_300_800],
          v: [0],
        });
      }),
    );

    const result = await client.callTool({
      arguments: {
        access_token: "test-token",
        from: 1_708_300_800,
        resolution: "D",
        symbol: "Crypto.ETH/USD",
        to: 1_708_473_600,
      },
      name: "get_candlestick_data",
    });

    expect(result.isError).toBeFalsy();
    expect(upstreamSymbol).toBe("Crypto.ETH/USD");
  });
});
