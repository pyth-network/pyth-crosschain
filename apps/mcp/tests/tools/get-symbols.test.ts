import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import { clearSymbolsCache } from "../../src/clients/symbols-store.js";
import { loadConfig } from "../../src/config.js";
import type { SessionContext } from "../../src/server.js";
import { registerAllTools } from "../../src/tools/index.js";
import { clientTokenFromHeader } from "../../src/utils/access-token.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://pyth.dourolabs.app";

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
    // All filtering is client-side over the cached catalog; assert no filter
    // params are ever sent upstream.
    if ([...url.searchParams.keys()].length > 0) {
      return new HttpResponse("filter params must not be sent upstream", {
        status: 400,
      });
    }
    return HttpResponse.json(mockFeeds);
  }),
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
    expect(data.server_time_utc).toBeDefined();
    expect(data.server_unix_seconds).toBeDefined();
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

  it("accepts the new asset types", async () => {
    for (const assetType of ["interest-rate", "crypto-index", "kalshi"]) {
      const result = await client.callTool({
        arguments: { asset_type: assetType },
        name: "get_symbols",
      });
      expect(result.isError).toBeFalsy();
    }
  });

  it("combines asset_type and query filters", async () => {
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

describe("get_symbols entitlement", () => {
  const entitlementFeeds = [
    {
      asset_type: "crypto",
      description: "Bitcoin / US Dollar",
      exponent: -8,
      groups: [],
      hermes_id: null,
      min_channel: "real_time",
      name: "BTCUSD",
      pyth_lazer_id: 1,
      quote_currency: "USD",
      state: "stable",
      symbol: "Crypto.BTC/USD",
    },
    {
      asset_type: "commodity",
      description: "Pyth Oil Index",
      exponent: -8,
      groups: ["pyth-indices"],
      hermes_id: null,
      min_channel: "fixed_rate@200ms",
      name: "PYTHOIL",
      pyth_lazer_id: 3063,
      quote_currency: "USD",
      state: "stable",
      symbol: "Commodities.Index.PYTHOIL/USD",
    },
    {
      asset_type: "equity",
      description: "Upcoming listing",
      exponent: -5,
      groups: [],
      hermes_id: null,
      min_channel: "fixed_rate@200ms",
      name: "NEWCO",
      pyth_lazer_id: 4000,
      quote_currency: "USD",
      state: "coming_soon",
      symbol: "Equity.US.NEWCO/USD",
    },
    {
      asset_type: "crypto",
      description: "Beta feed",
      exponent: -8,
      groups: [],
      hermes_id: null,
      min_channel: "fixed_rate@200ms",
      name: "BETA",
      pyth_lazer_id: 4001,
      quote_currency: "USD",
      state: "beta",
      symbol: "Crypto.BETA/USD",
    },
  ];
  // Visible only with a token.
  const proOnlyFeed = {
    ...entitlementFeeds[0],
    description: "Kalshi market",
    name: "KXF1",
    pyth_lazer_id: 5000,
    symbol: "KLP.KXF1_25_LN/USD",
  };

  let requests: Array<{ auth: string | null; entitledOnly: boolean }>;

  beforeEach(() => {
    requests = [];
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
        const url = new URL(request.url);
        const auth = request.headers.get("Authorization");
        const entitledOnly = url.searchParams.get("entitled_only") === "true";
        requests.push({ auth, entitledOnly });
        if (entitledOnly) {
          if (!auth) return new HttpResponse(null, { status: 401 });
          if (auth === "Bearer bad-token") {
            return new HttpResponse(null, { status: 401 });
          }
          return HttpResponse.json([entitlementFeeds[0], proOnlyFeed]);
        }
        if (auth === "Bearer bad-token") {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json(
          auth ? [...entitlementFeeds, proOnlyFeed] : entitlementFeeds,
        );
      }),
    );
  });

  async function callGetSymbols(args: Record<string, unknown>) {
    const config = loadConfig();
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
      name: "get_symbols",
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    return { result, text };
  }

  type FeedOut = {
    pyth_lazer_id: number;
    entitled?: boolean;
    not_entitled_reason?: string;
  };
  const byId = (feeds: FeedOut[], id: number) =>
    feeds.find((f) => f.pyth_lazer_id === id);

  it("without a token returns public feeds, no entitled flag, and a note", async () => {
    const { text } = await callGetSymbols({});
    const data = JSON.parse(text);
    expect(data.total_available).toBe(4);
    expect(data.feeds.every((f: FeedOut) => f.entitled === undefined)).toBe(
      true,
    );
    expect(data.note).toContain("access_token");
    expect(requests).toEqual([{ auth: null, entitledOnly: false }]);
  });

  it("with a token returns Pro-only feeds and flags each feed", async () => {
    const { text } = await callGetSymbols({ access_token: "pro-token" });
    const data = JSON.parse(text);
    expect(data.note).toBeUndefined();
    expect(data.total_available).toBe(5);
    const feeds = data.feeds as FeedOut[];
    expect(byId(feeds, 1)).toMatchObject({ entitled: true });
    expect(byId(feeds, 1)?.not_entitled_reason).toBeUndefined();
    expect(byId(feeds, 5000)).toMatchObject({ entitled: true });
    expect(byId(feeds, 3063)).toMatchObject({
      entitled: false,
      not_entitled_reason: "requires one of entitlement groups: pyth-indices",
    });
    expect(byId(feeds, 4000)).toMatchObject({
      entitled: false,
      not_entitled_reason: "not_live (coming_soon)",
    });
    expect(byId(feeds, 4001)).toMatchObject({
      entitled: false,
      not_entitled_reason: "not_live (beta)",
    });
    // Exactly the two authenticated lists, no anonymous or repeated fetch.
    expect(requests).toHaveLength(2);
    expect(requests).toEqual(
      expect.arrayContaining([
        { auth: "Bearer pro-token", entitledOnly: false },
        { auth: "Bearer pro-token", entitledOnly: true },
      ]),
    );
  });

  it("uses the key from the user's client configuration", async () => {
    const config = loadConfig();
    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    registerAllTools(
      mcpServer,
      config,
      new HistoryClient(config, logger),
      new RouterClient(config, logger),
      logger,
      {
        ...createSessionContext(),
        clientAccessToken: clientTokenFromHeader("Bearer pro-token"),
      },
    );
    const client = await createTestClient(mcpServer);
    const result = await client.callTool({
      arguments: {},
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.note).toBeUndefined();
    expect(data.total_available).toBe(5);
    expect(requests.every((r) => r.auth === "Bearer pro-token")).toBe(true);
  });

  it("maps a 401 to the invalid-token message", async () => {
    const { result, text } = await callGetSymbols({
      access_token: "bad-token",
    });
    expect(result.isError).toBe(true);
    expect(text).toContain("invalid or expired");
  });

  it.each([
    ["a 500", 500],
    ["a 403", 403],
  ])("still lists feeds when the entitled list fails with %s", async (_label, status) => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("entitled_only") === "true") {
          return new HttpResponse("boom", { status });
        }
        return undefined;
      }),
    );
    const { result, text } = await callGetSymbols({
      access_token: "pro-token",
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(text);
    expect(data.total_available).toBe(5);
    expect(
      (data.feeds as FeedOut[]).every((f) => f.entitled === undefined),
    ).toBe(true);
    expect(data.note).toContain("Could not load which feeds");
  });

  it("caches the entitled list per token and never mixes tokens", async () => {
    const calls: Array<{ auth: string | null; entitledOnly: boolean }> = [];
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
        const auth = request.headers.get("Authorization");
        const entitledOnly =
          new URL(request.url).searchParams.get("entitled_only") === "true";
        calls.push({ auth, entitledOnly });
        if (!entitledOnly) return HttpResponse.json(entitlementFeeds);
        // token-a may query BTC; token-b may query the oil index.
        return HttpResponse.json(
          auth === "Bearer token-a"
            ? [entitlementFeeds[0]]
            : [entitlementFeeds[1]],
        );
      }),
    );
    const flags = async (token: string) => {
      const { text } = await callGetSymbols({ access_token: token });
      const feeds = JSON.parse(text).feeds as FeedOut[];
      return [byId(feeds, 1)?.entitled, byId(feeds, 3063)?.entitled];
    };

    expect(await flags("token-a")).toEqual([true, false]);
    expect(await flags("token-a")).toEqual([true, false]);
    expect(await flags("token-b")).toEqual([false, true]);
    // token-a's two lists once, then token-b's two lists.
    expect(calls).toHaveLength(4);
    expect(calls.filter((c) => c.auth === "Bearer token-a")).toHaveLength(2);
    expect(calls.filter((c) => c.auth === "Bearer token-b")).toHaveLength(2);
  });

  it("warns when a token is entitled to nothing (the API accepts unknown tokens)", async () => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("entitled_only") === "true") {
          return HttpResponse.json([]);
        }
        return HttpResponse.json(entitlementFeeds);
      }),
    );
    const { result, text } = await callGetSymbols({
      access_token: "made-up-token",
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(text);
    expect(data.note).toContain("not entitled to any feed");
    expect(data.note).toContain("invalid or expired");
  });
});

describe("get_symbols inactive feeds", () => {
  const feeds = [
    { pyth_lazer_id: 1, state: "stable", symbol: "Crypto.BTC/USD" },
    { pyth_lazer_id: 2, state: "inactive", symbol: "Crypto.OLD/USD" },
    { pyth_lazer_id: 3, state: "coming_soon", symbol: "Crypto.NEW/USD" },
  ].map((f) => ({
    asset_type: "crypto",
    description: f.symbol,
    exponent: -8,
    hermes_id: null,
    min_channel: "fixed_rate@200ms",
    name: f.symbol,
    quote_currency: "USD",
    ...f,
  }));

  let client: Client;

  beforeAll(async () => {
    const config = loadConfig();
    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    registerAllTools(
      mcpServer,
      config,
      new HistoryClient(config, logger),
      new RouterClient(config, logger),
      logger,
      createSessionContext(),
    );
    client = await createTestClient(mcpServer);
  });

  beforeEach(() => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(feeds)),
    );
  });

  async function ids(args: Record<string, unknown>) {
    const result = await client.callTool({
      arguments: args,
      name: "get_symbols",
    });
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    return data.feeds.map((f: { pyth_lazer_id: number }) => f.pyth_lazer_id);
  }

  it("hides inactive feeds by default but keeps coming_soon", async () => {
    expect(await ids({})).toEqual([1, 3]);
  });

  it("shows inactive feeds with include_inactive", async () => {
    expect(await ids({ include_inactive: true })).toEqual([1, 2, 3]);
  });
});

describe("get_symbols instrument and futures-chain filters", () => {
  const feeds = [
    { instrument_type: "spot", pyth_lazer_id: 1, symbol: "Crypto.BTC/USD" },
    {
      expiration_time: "2026-11-18T08:00:00",
      instrument_type: "future",
      market_sessions: {
        post_market: null,
        regular: { min_pub: 1, schedule: "America/Chicago;O", state: "stable" },
      },
      pyth_lazer_id: 2,
      symbol: "Futures.VXX6/USD",
      symbol_chain_id: "VX",
    },
    {
      instrument_type: "future",
      pyth_lazer_id: 3,
      symbol: "Futures.BRENTF7/USD",
      symbol_chain_id: "BRENT",
    },
  ].map((f) => ({
    asset_type: "commodity",
    description: f.symbol,
    exponent: -8,
    hermes_id: null,
    min_channel: "fixed_rate@200ms",
    name: f.symbol,
    quote_currency: null,
    state: "stable",
    ...f,
  }));

  let client: Client;

  beforeAll(async () => {
    const config = loadConfig();
    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    registerAllTools(
      mcpServer,
      config,
      new HistoryClient(config, logger),
      new RouterClient(config, logger),
      logger,
      createSessionContext(),
    );
    client = await createTestClient(mcpServer);
  });

  beforeEach(() => {
    msw.use(
      http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(feeds)),
    );
  });

  async function call(args: Record<string, unknown>) {
    const result = await client.callTool({
      arguments: args,
      name: "get_symbols",
    });
    return JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
  }

  it("filters by instrument_type", async () => {
    const data = await call({ instrument_type: "future" });
    expect(
      data.feeds.map((f: { pyth_lazer_id: number }) => f.pyth_lazer_id),
    ).toEqual([2, 3]);
  });

  it("filters by symbol_chain_id exactly", async () => {
    expect((await call({ symbol_chain_id: "VX" })).total_available).toBe(1);
    expect((await call({ symbol_chain_id: "vx" })).total_available).toBe(0);
  });

  it("keeps market session state, null sessions and futures fields with verbose", async () => {
    const data = await call({ symbol_chain_id: "VX", verbose: true });
    const feed = data.feeds[0];
    expect(feed.market_sessions.regular.state).toBe("stable");
    expect(feed.market_sessions.post_market).toBeNull();
    expect(feed.expiration_time).toBe("2026-11-18T08:00:00");
    expect(feed.quote_currency).toBeNull();
  });

  it("returns compact feeds by default, keeping futures fields", async () => {
    const data = await call({ symbol_chain_id: "VX" });
    const feed = data.feeds[0];
    expect(feed.market_sessions).toBeUndefined();
    expect(feed.expiration_time).toBe("2026-11-18T08:00:00");
    expect(feed.symbol_chain_id).toBe("VX");
    expect(Object.keys(feed).sort()).toEqual([
      "asset_type",
      "description",
      "expiration_time",
      "exponent",
      "instrument_type",
      "min_channel",
      "name",
      "pyth_lazer_id",
      "quote_currency",
      "state",
      "symbol",
      "symbol_chain_id",
    ]);
  });
});
