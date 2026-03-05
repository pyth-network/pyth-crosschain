import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import {
  extractHttpStatusFromMessage,
  RouterClient,
} from "../../src/clients/router.js";
import { HttpError } from "../../src/clients/retry.js";

const ROUTER_URL = "https://pyth-lazer.dourolabs.app";

const mockLatestPrice = {
  leUnsigned: { data: "binary1", encoding: "base64" },
  parsed: {
    priceFeeds: [
      {
        bestAskPrice: "5100100000000",
        bestBidPrice: "5099900000000",
        confidence: "1000000",
        exponent: -8,
        price: "5100000000000",
        priceFeedId: 1,
        publisherCount: 5,
      },
    ],
    timestampUs: "1708300800000000",
  },
};

let lastRequestBody: Record<string, unknown> = {};

const handlers = [
  http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    lastRequestBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(mockLatestPrice);
  }),
];

const server = setupServer(...handlers);
const logger = pino({ level: "silent" });

const config = {
  channel: "fixed_rate@200ms",
  historyUrl: "https://history.pyth-lazer.dourolabs.app",
  logLevel: "info" as const,
  requestTimeoutMs: 10_000,
  routerUrl: ROUTER_URL,
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("RouterClient", () => {
  const client = new RouterClient(config, logger);

  it("returns normalized feeds with snake_case and numeric values", async () => {
    const { data: feeds, upstreamLatencyMs } = await client.getLatestPrice(
      "test-token",
      ["Crypto.BTC/USD"],
    );
    expect(feeds).toHaveLength(1);
    expect(feeds[0].price_feed_id).toBe(1);
    expect(feeds[0].timestamp_us).toBe(1_708_300_800_000_000);
    expect(feeds[0].price).toBe(5_100_000_000_000);
    expect(feeds[0].best_bid_price).toBe(5_099_900_000_000);
    expect(feeds[0].best_ask_price).toBe(5_100_100_000_000);
    expect(feeds[0].confidence).toBe(1_000_000);
    expect(feeds[0].exponent).toBe(-8);
    expect(feeds[0].publisher_count).toBe(5);
    expect(upstreamLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("sends Authorization header", async () => {
    const { data: feeds } = await client.getLatestPrice("my-secret-token", [
      "Crypto.BTC/USD",
    ]);
    expect(feeds).toHaveLength(1);
  });

  it("sends properties, formats, and camelCase priceFeedIds", async () => {
    await client.getLatestPrice("test-token", undefined, [1, 2]);
    expect(lastRequestBody.properties).toEqual([
      "price",
      "bestBidPrice",
      "bestAskPrice",
      "exponent",
      "publisherCount",
      "confidence",
    ]);
    expect(lastRequestBody.formats).toEqual(["leUnsigned"]);
    expect(lastRequestBody.priceFeedIds).toEqual([1, 2]);
    expect(lastRequestBody).not.toHaveProperty("price_feed_ids");
  });

  it("throws on 403 (invalid token)", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(
      client.getLatestPrice("bad-token", ["BTC/USD"]),
    ).rejects.toThrow("403");
  });

  it("maps 403 to HttpError with status for downstream instanceof check", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );
    const err = await client
      .getLatestPrice("bad-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(403);
  });

  it("maps 429 to HttpError with status", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        HttpResponse.text("Rate limited", { status: 429 }),
      ),
    );
    // 429 is retryable — after retry it still throws
    const err = await client
      .getLatestPrice("test-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(429);
  });

  it("maps 503 to HttpError with status", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        HttpResponse.text("Service Unavailable", { status: 503 }),
      ),
    );
    const err = await client
      .getLatestPrice("test-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
  });

  it("throws HttpError(502) when parsed data is missing", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        HttpResponse.json({ leUnsigned: { data: "abc", encoding: "base64" } }),
      ),
    );
    const err = await client
      .getLatestPrice("test-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(502);
    expect((err as HttpError).message).toContain("no parsed data");
  });

  it("throws HttpError(502) when upstream returns malformed body", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        new HttpResponse("not json", {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );
    const err = await client
      .getLatestPrice("test-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(502);
  });

  it("rejects with timeout error when upstream is slow", async () => {
    const shortTimeoutConfig = { ...config, requestTimeoutMs: 50 };
    const shortClient = new RouterClient(shortTimeoutConfig, logger);

    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, async () => {
        await new Promise((r) => setTimeout(r, 30_000));
        return HttpResponse.json(mockLatestPrice);
      }),
    );

    const err = await shortClient
      .getLatestPrice("test-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("TimeoutError");
  }, 15_000);
});

describe("extractHttpStatusFromMessage", () => {
  it("extracts status from different HTTP error message formats", () => {
    expect(
      extractHttpStatusFromMessage("HTTP error! status: 403 - Unauthorized"),
    ).toBe(403);
    expect(extractHttpStatusFromMessage("http error status=429")).toBe(429);
    expect(extractHttpStatusFromMessage("HTTP 503 Service Unavailable")).toBe(
      503,
    );
  });

  it("returns undefined when no status code exists", () => {
    expect(
      extractHttpStatusFromMessage("Failed to fetch latest price: malformed"),
    ).toBeUndefined();
  });
});
