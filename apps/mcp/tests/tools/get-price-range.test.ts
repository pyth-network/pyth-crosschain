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

const HISTORY_URL = "https://pyth.dourolabs.app";
const RANGE_URL = `${HISTORY_URL}/v1/fixed_rate@200ms/price/range`;
const START_S = 1_790_970_319;

const mockFeeds = [
  {
    asset_type: "crypto",
    description: "BITCOIN / US DOLLAR",
    exponent: -8,
    hermes_id: null,
    instrument_type: "spot",
    min_channel: "real_time",
    name: "BTCUSD",
    pyth_lazer_id: 1,
    quote_currency: "USD",
    state: "stable",
    symbol: "Crypto.BTC/USD",
  },
];

function row(publishTimeUs: number) {
  return {
    best_ask_price: 8_419_283_919_430,
    best_bid_price: 8_419_074_000_000,
    channel: 3,
    channel_name: "fixed_rate@200ms",
    confidence: 1_064_312_115,
    ema_confidence: 1_183_391_224,
    ema_price: 8_434_832_410_000,
    exponent: -8,
    feed_update_timestamp: publishTimeUs,
    funding_rate: null,
    funding_rate_interval: null,
    funding_timestamp: null,
    market_session: "regular",
    price: 8_419_242_000_000,
    price_feed_id: 1,
    publish_time: publishTimeUs,
    publisher_count: 27,
  };
}

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(mockFeeds)),
  http.get(RANGE_URL, () =>
    HttpResponse.json({
      data: [row(START_S * 1_000_000), row(START_S * 1_000_000 + 200_000)],
      next: "cursor-2",
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

const config = {
  channel: "fixed_rate@200ms" as const,
  historyUrl: HISTORY_URL,
  logLevel: "info" as const,
  requestTimeoutMs: 10_000,
  routerUrl: "https://pyth-lazer.dourolabs.app",
};

describe("get_price_range tool", () => {
  let client: Client;

  beforeAll(async () => {
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

  async function call(args: Record<string, unknown>) {
    const result = await client.callTool({
      arguments: { access_token: "pro-token", ...args },
      name: "get_price_range",
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    return { result, text };
  }

  it("returns rows with display values and a paging cursor", async () => {
    let query: URLSearchParams | undefined;
    let auth: string | null = null;
    msw.use(
      http.get(RANGE_URL, ({ request }) => {
        query = new URL(request.url).searchParams;
        auth = request.headers.get("Authorization");
        return HttpResponse.json({
          data: [row(START_S * 1_000_000)],
          next: "cursor-2",
        });
      }),
    );

    const { result, text } = await call({
      end: START_S + 10,
      price_feed_ids: [1],
      start: START_S,
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(text);
    expect(data.count).toBe(1);
    expect(data.has_more).toBe(true);
    expect(data.next_cursor).toBe("cursor-2");
    expect(data.prices[0].display_price).toBeCloseTo(84_192.42, 2);
    expect(data.prices[0].display_ema_price).toBeCloseTo(84_348.3241, 4);
    expect(data.window.start_us).toBe(START_S * 1_000_000);
    expect(query?.get("start_timestamp")).toBe(String(START_S * 1_000_000));
    expect(query?.get("end_timestamp")).toBe(
      String((START_S + 10) * 1_000_000),
    );
    expect(query?.get("limit")).toBe("100");
    expect(query?.getAll("ids")).toEqual(["1"]);
    expect(auth).toBe("Bearer pro-token");
  });

  it("forwards the paging cursor and reports the last page", async () => {
    let after: string | null = null;
    msw.use(
      http.get(RANGE_URL, ({ request }) => {
        after = new URL(request.url).searchParams.get("after");
        return HttpResponse.json({ data: [], next: null });
      }),
    );
    const { text } = await call({
      after: "cursor-2",
      end: START_S + 10,
      price_feed_ids: [1],
      start: START_S,
    });
    const data = JSON.parse(text);
    expect(after).toBe("cursor-2");
    expect(data.has_more).toBe(false);
    expect(data.next_cursor).toBeNull();
  });

  it("resolves bare symbols to feed IDs", async () => {
    let ids: string[] = [];
    msw.use(
      http.get(RANGE_URL, ({ request }) => {
        ids = new URL(request.url).searchParams.getAll("ids");
        return HttpResponse.json({ data: [], next: null });
      }),
    );
    const { text } = await call({
      end: START_S + 1,
      start: START_S,
      symbols: ["BTC/USD"],
    });
    expect(ids).toEqual(["1"]);
    expect(JSON.parse(text).resolved_symbols).toEqual({
      "BTC/USD": "Crypto.BTC/USD",
    });
  });

  it("accepts millisecond timestamps", async () => {
    let start: string | null = null;
    msw.use(
      http.get(RANGE_URL, ({ request }) => {
        start = new URL(request.url).searchParams.get("start_timestamp");
        return HttpResponse.json({ data: [], next: null });
      }),
    );
    await call({
      end: START_S * 1000 + 500,
      price_feed_ids: [1],
      start: START_S * 1000,
    });
    expect(start).toBe(String(START_S * 1_000_000));
  });

  it("rejects windows longer than 60 seconds without calling upstream", async () => {
    let called = false;
    msw.use(
      http.get(RANGE_URL, () => {
        called = true;
        return HttpResponse.json({ data: [], next: null });
      }),
    );
    const { result, text } = await call({
      end: START_S + 90,
      price_feed_ids: [1],
      start: START_S,
    });
    expect(result.isError).toBe(true);
    expect(text).toContain("at most 60");
    expect(called).toBe(false);
  });

  it("allows exactly 60 seconds", async () => {
    const { result } = await call({
      end: START_S + 60,
      price_feed_ids: [1],
      start: START_S,
    });
    expect(result.isError).toBeFalsy();
  });

  it("rejects end before start", async () => {
    const { result, text } = await call({
      end: START_S,
      price_feed_ids: [1],
      start: START_S + 5,
    });
    expect(result.isError).toBe(true);
    expect(text).toContain("'end' must be after 'start'");
  });

  it("requires feeds", async () => {
    const { result } = await call({ end: START_S + 5, start: START_S });
    expect(result.isError).toBe(true);
  });

  it("caps limit at 500", async () => {
    const { result } = await call({
      end: START_S + 5,
      limit: 1000,
      price_feed_ids: [1],
      start: START_S,
    });
    expect(result.isError).toBe(true);
  });

  it("maps 403 to the not-entitled message", async () => {
    msw.use(
      http.get(
        RANGE_URL,
        () =>
          new HttpResponse(
            'Not entitled: feed 3063 (requires access to one of the following groups: ["pyth-indices"])',
            { status: 403 },
          ),
      ),
    );
    const { result, text } = await call({
      end: START_S + 5,
      price_feed_ids: [3063],
      start: START_S,
    });
    expect(result.isError).toBe(true);
    expect(text).toContain("not entitled");
    expect(text).toContain("pyth-indices");
  });

  it("surfaces the upstream reason for a 400", async () => {
    msw.use(
      http.get(
        RANGE_URL,
        () =>
          new HttpResponse("invalid paging token", {
            status: 400,
          }),
      ),
    );
    const { result, text } = await call({
      after: "garbage",
      end: START_S + 5,
      price_feed_ids: [1],
      start: START_S,
    });
    expect(result.isError).toBe(true);
    expect(text).toContain("invalid paging token");
  });

  it("returns the missing-token message without a token", async () => {
    const result = await client.callTool({
      arguments: { end: START_S + 5, price_feed_ids: [1], start: START_S },
      name: "get_price_range",
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("requires your Pyth Pro access token");
  });
});
