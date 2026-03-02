import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { createServerCodeModeOnly } from "../../src/server.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";
const ROUTER_URL = "https://pyth-lazer.dourolabs.app";
const SECRET_TOKEN = "sk_prod_abc123secret456";

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () =>
    HttpResponse.json([
      {
        asset_type: "crypto",
        description: "Bitcoin",
        exponent: -8,
        hermes_id: null,
        market_sessions: {},
        min_channel: "fixed_rate@200ms",
        name: "Bitcoin",
        pyth_lazer_id: 1,
        quote_currency: "USD",
        state: "active",
        symbol: "BTC/USD",
      },
    ]),
  ),
  http.post(`${ROUTER_URL}/v1/latest_price`, () =>
    HttpResponse.json({
      leUnsigned: { data: "x", encoding: "base64" },
      parsed: {
        priceFeeds: [{ exponent: -8, price: "50000000000", priceFeedId: 1 }],
        timestampUs: "1708300800000000",
      },
    }),
  ),
);

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

describe("Security: token never leaks", () => {
  it("token does not appear in execute response content", async () => {
    const { server } = createServerCodeModeOnly({
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "error" as const,
      pythProAccessToken: SECRET_TOKEN,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    });
    const client = await createTestClient(server);

    const result = await client.callTool({
      name: "execute",
      arguments: {
        code: `async () => {
          const latest = await codemode.get_latest_price({ price_feed_ids: [1] });
          return JSON.stringify(latest);
        }`,
      },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).not.toContain(SECRET_TOKEN);
    expect(text).not.toContain("sk_");
    expect(text).not.toContain("sk_prod");
  });

  it("token does not appear in error response", async () => {
    const { server } = createServerCodeModeOnly({
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "error" as const,
      pythProAccessToken: undefined,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    });
    const client = await createTestClient(server);

    const result = await client.callTool({
      name: "execute",
      arguments: {
        code: `async () => await codemode.get_latest_price({ price_feed_ids: [1] })`,
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).not.toContain("sk_");
  });
});
