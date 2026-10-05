// biome-ignore-all lint/style/noProcessEnv: sets PYTH_PRO_ACCESS_TOKEN to prove the server ignores it
// biome-ignore-all lint/nursery/noUndeclaredEnvVars: same
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import { clearSymbolsCache } from "../../src/clients/symbols-store.js";
import { loadConfig } from "../../src/config.js";
import type { SessionContext } from "../../src/server.js";
import { createServer } from "../../src/server.js";
import { registerAllTools } from "../../src/tools/index.js";
import type { ClientAccessToken } from "../../src/utils/access-token.js";
import {
  clientTokenFromEnv,
  clientTokenFromHeader,
} from "../../src/utils/access-token.js";
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

    let body: Record<string, unknown> | undefined;
    let symbolLookups = 0;
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, () => {
        symbolLookups++;
        return HttpResponse.json(mockFeeds);
      }),
      http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(mockLatestPrice);
      }),
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
    // The Router rejects bodies with both; and IDs need no catalog lookup.
    expect(body?.symbols).toBeUndefined();
    expect(body?.priceFeedIds).toEqual(ids);
    expect(symbolLookups).toBe(0);
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

  it("rejects a token with a line break inside without echoing it", async () => {
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
      arguments: {
        access_token: "secretpart1\nsecretpart2",
        price_feed_ids: [1],
      },
      name: "get_latest_price",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).toContain("single line");
    expect(text).not.toContain("secretpart");
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

  describe("bring your own key", () => {
    it("ignores PYTH_PRO_ACCESS_TOKEN in the server environment", async () => {
      const previous = process.env.PYTH_PRO_ACCESS_TOKEN;
      process.env.PYTH_PRO_ACCESS_TOKEN = "server-side-key";
      let routerCalled = false;
      msw.use(
        http.post(`${ROUTER_URL}/v1/latest_price`, () => {
          routerCalled = true;
          return HttpResponse.json(mockLatestPrice);
        }),
      );
      try {
        // What http.ts does for a request without an Authorization header.
        const { server: mcpServer } = createServer(loadConfig(), logger);
        const client = await createTestClient(mcpServer);
        const result = await client.callTool({
          arguments: { price_feed_ids: [1] },
          name: "get_latest_price",
        });
        expect(result.isError).toBe(true);
        expect(routerCalled).toBe(false);
        const text = (
          result.content as Array<{ type: string; text: string }>
        )[0].text;
        expect(text).toContain("requires your Pyth Pro access token");
      } finally {
        if (previous === undefined) delete process.env.PYTH_PRO_ACCESS_TOKEN;
        else process.env.PYTH_PRO_ACCESS_TOKEN = previous;
      }
    });

    async function callWithClientToken(
      clientAccessToken: ClientAccessToken | undefined,
      args: Record<string, unknown>,
    ) {
      let auth: string | null = null;
      let routerCalled = false;
      msw.use(
        http.post(`${ROUTER_URL}/v1/latest_price`, ({ request }) => {
          routerCalled = true;
          auth = request.headers.get("Authorization");
          return HttpResponse.json(mockLatestPrice);
        }),
      );
      const { server: mcpServer } = createServer(
        { ...loadConfig(), historyUrl: HISTORY_URL, routerUrl: ROUTER_URL },
        logger,
        clientAccessToken,
      );
      const client = await createTestClient(mcpServer);
      const result = await client.callTool({
        arguments: { price_feed_ids: [1], ...args },
        name: "get_latest_price",
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      return { auth, result, routerCalled, text };
    }

    it("uses the key from the user's client configuration", async () => {
      const { auth, result } = await callWithClientToken(
        clientTokenFromHeader("Bearer from-client"),
        {},
      );
      expect(result.isError).toBeFalsy();
      expect(auth).toBe("Bearer from-client");
    });

    it("lets access_token on the call override the configured key", async () => {
      const { auth } = await callWithClientToken(
        clientTokenFromEnv("from-env"),
        { access_token: "from-call" },
      );
      expect(auth).toBe("Bearer from-call");
    });

    it("reports a malformed configured key instead of 'missing'", async () => {
      const { result, routerCalled, text } = await callWithClientToken(
        clientTokenFromHeader("Basic nope"),
        {},
      );
      expect(result.isError).toBe(true);
      expect(routerCalled).toBe(false);
      expect(text).toContain("Authorization header");
      expect(text).not.toContain("nope");
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

    it("reports the Router's 403 for an unknown feed ID as not found", async () => {
      const { result, text } = await callWithUpstream(
        403,
        "Unknown feed: 4000000",
      );
      expect(result.isError).toBe(true);
      expect(text).toContain("does not know this feed");
      expect(text).not.toContain("not entitled");
    });

    it("shows the Router's reason for a 400 instead of 'try again'", async () => {
      const { result, text } = await callWithUpstream(
        400,
        "Price feed id 3063 is not available for channel real_time",
      );
      expect(result.isError).toBe(true);
      expect(text).toContain(
        "Price feed id 3063 is not available for channel real_time",
      );
      expect(text).not.toMatch(/try again/i);
    });
  });

  describe("request contents", () => {
    async function callCapturing(args: Record<string, unknown>) {
      let body: Record<string, unknown> | undefined;
      const symbolAuth: Array<string | null> = [];
      msw.use(
        http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
          const auth = request.headers.get("Authorization");
          symbolAuth.push(auth);
          // A Pro-only feed, listed only for authenticated callers.
          const proOnly = {
            ...mockFeeds[0],
            pyth_lazer_id: 5000,
            state: "stable",
            symbol: "KLP.KXF1/USD",
          };
          return HttpResponse.json(auth ? [...mockFeeds, proOnly] : mockFeeds);
        }),
        http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            parsed: {
              priceFeeds: [
                {
                  exponent: -12,
                  fundingRate: "-15410000",
                  priceFeedId: (body.priceFeedIds as number[])[0],
                },
              ],
              timestampUs: "1708300800000000",
            },
          });
        }),
      );
      const config = {
        ...loadConfig(),
        historyUrl: HISTORY_URL,
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
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      return { body, result, symbolAuth, text };
    }

    it("forwards the requested properties and returns display_funding_rate", async () => {
      const { body, text } = await callCapturing({
        access_token: "t",
        price_feed_ids: [112],
        properties: ["fundingRate", "exponent"],
      });
      expect(body?.properties).toEqual(["fundingRate", "exponent"]);
      const price = JSON.parse(text).prices[0];
      expect(price.funding_rate).toBe(-15_410_000);
      expect(price.display_funding_rate).toBeCloseTo(-1.541e-5, 12);
    });

    it("resolves a Pro-only symbol with the caller's token", async () => {
      const { body, result, symbolAuth } = await callCapturing({
        access_token: "pro-token",
        symbols: ["KXF1/USD"],
      });
      expect(result.isError).toBeFalsy();
      expect(symbolAuth).toEqual(["Bearer pro-token"]);
      expect(body?.priceFeedIds).toEqual([5000]);
    });
  });

  describe("partial results", () => {
    it("names requested feeds that came back without a price", async () => {
      const config = loadConfig();
      const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
      registerAllTools(
        mcpServer,
        { ...config, historyUrl: HISTORY_URL, routerUrl: ROUTER_URL },
        new HistoryClient(
          { ...config, historyUrl: HISTORY_URL, routerUrl: ROUTER_URL },
          logger,
        ),
        new RouterClient(
          { ...config, historyUrl: HISTORY_URL, routerUrl: ROUTER_URL },
          logger,
        ),
        logger,
        createSessionContext(),
      );
      const client = await createTestClient(mcpServer);
      // The default Router mock returns feed 1 only, as the live Router does
      // for a coming_soon feed requested next to BTC.
      const result = await client.callTool({
        arguments: { access_token: "t", price_feed_ids: [1, 311] },
        name: "get_latest_price",
      });
      const data = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(data.prices).toHaveLength(1);
      expect(data.missing_feed_ids).toEqual([311]);
      expect(data.missing_feeds_hint).toContain("get_symbols");
    });

    it("omits missing_feed_ids when every feed came back", async () => {
      const config = {
        ...loadConfig(),
        historyUrl: HISTORY_URL,
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
        arguments: { access_token: "t", price_feed_ids: [1] },
        name: "get_latest_price",
      });
      const data = JSON.parse(
        (result.content as Array<{ type: string; text: string }>)[0].text,
      );
      expect(data.missing_feed_ids).toBeUndefined();
    });
  });

  describe("channel validation", () => {
    async function callWithChannel(channel: string) {
      let sentChannel: unknown;
      msw.use(
        http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
          sentChannel = ((await request.json()) as { channel: unknown })
            .channel;
          return HttpResponse.json(mockLatestPrice);
        }),
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
        arguments: { access_token: "t", channel, price_feed_ids: [1] },
        name: "get_latest_price",
      });
      return { result, sentChannel };
    }

    it("accepts fixed_rate@1000ms", async () => {
      const { result, sentChannel } =
        await callWithChannel("fixed_rate@1000ms");
      expect(result.isError).toBeFalsy();
      expect(sentChannel).toBe("fixed_rate@1000ms");
    });

    it("rejects a channel the API does not support", async () => {
      const { result, sentChannel } = await callWithChannel("fixed_rate@123ms");
      expect(result.isError).toBe(true);
      expect(sentChannel).toBeUndefined();
    });
  });

  describe("symbol resolution", () => {
    async function callWithSymbols(symbols: string[]) {
      let body: Record<string, unknown> | undefined;
      msw.use(
        http.get(`${HISTORY_URL}/v1/symbols`, () =>
          HttpResponse.json([
            {
              ...mockFeeds[0],
              instrument_type: "spot",
              state: "stable",
              symbol: "Crypto.BTC/USD",
            },
            {
              ...mockFeeds[0],
              instrument_type: "rate",
              pyth_lazer_id: 77,
              state: "stable",
              symbol: "FundingRate.Hyperliquid.BTC/USD",
            },
          ]),
        ),
        http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockLatestPrice);
        }),
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
        arguments: { access_token: "t", symbols },
        name: "get_latest_price",
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      return { body, result, text };
    }

    it("resolves a bare pair and sends feed IDs to the Router", async () => {
      const { body, result, text } = await callWithSymbols(["BTC/USD"]);
      expect(result.isError).toBeFalsy();
      expect(body?.priceFeedIds).toEqual([1]);
      expect(body?.symbols).toBeUndefined();
      expect(JSON.parse(text).resolved_symbols).toEqual({
        "BTC/USD": "Crypto.BTC/USD",
      });
    });

    it("omits resolved_symbols when full symbols are passed", async () => {
      const { text } = await callWithSymbols(["Crypto.BTC/USD"]);
      expect(JSON.parse(text).resolved_symbols).toBeUndefined();
    });

    it("passes symbols through to the Router when the catalog is down", async () => {
      let body: Record<string, unknown> | undefined;
      msw.use(
        http.get(
          `${HISTORY_URL}/v1/symbols`,
          () => new HttpResponse(null, { status: 500 }),
        ),
        http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockLatestPrice);
        }),
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
        arguments: { access_token: "t", symbols: ["Crypto.BTC/USD"] },
        name: "get_latest_price",
      });
      expect(result.isError).toBeFalsy();
      expect(body?.symbols).toEqual(["Crypto.BTC/USD"]);
      expect(body?.priceFeedIds).toBeUndefined();
    });

    it("asks for full symbols when the catalog is down and the Router rejects a bare pair", async () => {
      msw.use(
        http.get(
          `${HISTORY_URL}/v1/symbols`,
          () => new HttpResponse(null, { status: 500 }),
        ),
        http.post(
          `${ROUTER_URL}/v1/latest_price`,
          () => new HttpResponse("unknown symbol", { status: 400 }),
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
        arguments: { access_token: "t", symbols: ["BTC/USD"] },
        name: "get_latest_price",
      });
      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      expect(text).toContain("feed catalog is unavailable");
      // The user's input, not just the example in the message.
      expect(text).toContain("rejected BTC/USD");
    });

    it("still reports an invalid token from the catalog lookup", async () => {
      let routerCalled = false;
      msw.use(
        http.get(
          `${HISTORY_URL}/v1/symbols`,
          () => new HttpResponse(null, { status: 401 }),
        ),
        http.post(`${ROUTER_URL}/v1/latest_price`, () => {
          routerCalled = true;
          return HttpResponse.json(mockLatestPrice);
        }),
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
        arguments: { access_token: "bad", symbols: ["Crypto.BTC/USD"] },
        name: "get_latest_price",
      });
      expect(result.isError).toBe(true);
      expect(routerCalled).toBe(false);
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      expect(text).toContain("invalid or expired");
    });

    it("still calls the Router when History answers 403 for the catalog", async () => {
      // The price comes from the Router, which may accept a key that
      // History does not; the symbols are passed through unresolved.
      let body: Record<string, unknown> | undefined;
      msw.use(
        http.get(
          `${HISTORY_URL}/v1/symbols`,
          () => new HttpResponse("forbidden", { status: 403 }),
        ),
        http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockLatestPrice);
        }),
      );
      const config = {
        ...loadConfig(),
        historyUrl: HISTORY_URL,
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
        arguments: { access_token: "t", symbols: ["Crypto.BTC/USD"] },
        name: "get_latest_price",
      });
      expect(result.isError).toBeFalsy();
      expect(body?.symbols).toEqual(["Crypto.BTC/USD"]);
    });

    it("returns an error without calling the Router for unknown symbols", async () => {
      const { body, result, text } = await callWithSymbols(["NOPE/USD"]);
      expect(result.isError).toBe(true);
      expect(body).toBeUndefined();
      expect(text).toContain("Feed not found: NOPE/USD");
    });
  });
});
