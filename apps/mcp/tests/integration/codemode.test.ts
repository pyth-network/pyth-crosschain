import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createServerCodeModeOnly } from "../../src/server.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";
const ROUTER_URL = "https://pyth-lazer.dourolabs.app";

const mockConfig = {
  channel: "fixed_rate@200ms",
  historyUrl: HISTORY_URL,
  logLevel: "info" as const,
  pythProAccessToken: "test-token",
  requestTimeoutMs: 10_000,
  routerUrl: ROUTER_URL,
};

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
];

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json(mockFeeds)),
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

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

describe("Integration: Code Mode only server", () => {
  it("lists exactly search and execute tools", async () => {
    const { server } = createServerCodeModeOnly({
      ...mockConfig,
      pythProAccessToken: "test-token-for-codemode",
    });
    const client = await createTestClient(server);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();

    expect(names).toEqual(["execute", "search"]);
    expect(names).toHaveLength(2);
  });

  it("search returns type definitions", async () => {
    const { server } = createServerCodeModeOnly({
      ...mockConfig,
      pythProAccessToken: undefined,
    });
    const client = await createTestClient(server);

    const result = await client.callTool({
      name: "search",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("get_symbols");
    expect(text).toContain("get_latest_price");
    expect(text).not.toContain("access_token");
  });

  it("execute runs multi-step workflow in one roundtrip", async () => {
    const { server } = createServerCodeModeOnly(mockConfig);
    const client = await createTestClient(server);

    const result = await client.callTool({
      name: "execute",
      arguments: {
        code: `async () => {
          const symbols = await codemode.get_symbols({ query: "BTC" });
          const btc = symbols.feeds.find(f => f.symbol === "BTC/USD");
          if (!btc) return { error: "not found" };
          const latest = await codemode.get_latest_price({ price_feed_ids: [btc.pyth_lazer_id] });
          return { symbol: btc.symbol, price: latest[0]?.display_price ?? latest[0]?.price };
        }`,
      },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    const data = JSON.parse(text);
    expect(data.symbol).toBe("BTC/USD");
    expect(data.price).toBeDefined();
    expect(text).not.toContain("test-token");
    expect(text).not.toContain("sk_");
  });
});
