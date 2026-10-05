import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HttpError } from "../../src/clients/retry.js";
import { RouterClient, verifyKeyWithRouter } from "../../src/clients/router.js";
import { clearSymbolsCache } from "../../src/clients/symbols-store.js";

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
let lastAuthHeader: string | null = null;

const handlers = [
  http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    lastAuthHeader = authHeader;
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
afterEach(() => {
  server.resetHandlers();
  clearSymbolsCache();
  // So a test can never pass on a previous test's request.
  lastRequestBody = {};
  lastAuthHeader = null;
});
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
    expect(lastAuthHeader).toBe("Bearer my-secret-token");
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
      "marketSession",
      "feedUpdateTimestamp",
    ]);
    expect(lastRequestBody.formats).toEqual([]);
    expect(lastRequestBody.parsed).toBe(true);
    expect(lastRequestBody.priceFeedIds).toEqual([1, 2]);
    expect(lastRequestBody).not.toHaveProperty("price_feed_ids");
    expect(lastRequestBody.symbols).toBeUndefined();
  });

  it("maps the newer properties to snake_case numbers", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () =>
        HttpResponse.json({
          parsed: {
            priceFeeds: [
              {
                emaConfidence: 2972,
                emaPrice: "33349628",
                exponent: -5,
                feedUpdateTimestamp: 1_790_973_919_800_000,
                fundingRate: 12_140_000,
                fundingRateInterval: 28_800_000_000,
                fundingTimestamp: 1_790_956_800_000_000,
                marketSession: "postMarket",
                priceFeedId: 922,
              },
            ],
            timestampUs: "1790973919800000",
          },
        }),
      ),
    );
    const { data } = await client.getLatestPrice(
      "t",
      undefined,
      [922],
      [
        "emaPrice",
        "emaConfidence",
        "marketSession",
        "feedUpdateTimestamp",
        "fundingRate",
        "fundingTimestamp",
        "fundingRateInterval",
        "exponent",
      ],
    );
    expect(data[0]).toEqual({
      ema_confidence: 2972,
      ema_price: 33_349_628,
      exponent: -5,
      feed_update_timestamp: 1_790_973_919_800_000,
      funding_rate: 12_140_000,
      funding_rate_interval: 28_800_000_000,
      funding_timestamp: 1_790_956_800_000_000,
      market_session: "postMarket",
      price_feed_id: 922,
      timestamp_us: 1_790_973_919_800_000,
    });
  });

  it("rejects an unknown property", async () => {
    const err = await client
      .getLatestPrice("t", undefined, [1], ["notAProperty"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
  });

  it("throws on 403 (token not entitled)", async () => {
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
      http.post(
        `${ROUTER_URL}/v1/latest_price`,
        () =>
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
      http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
        // Stall until the client aborts, without leaving a timer behind
        // that keeps Jest alive after the run.
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 30_000);
          request.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        return HttpResponse.json(mockLatestPrice);
      }),
    );

    const err = await shortClient
      .getLatestPrice("test-token", ["BTC/USD"])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("TimeoutError");
  }, 15_000);

  it("retries when the connection drops mid-body ('terminated')", async () => {
    let calls = 0;
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () => {
        calls++;
        if (calls === 1) {
          // What Node's fetch rejects with when the socket closes mid-body.
          const cut = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"parsed":'));
              controller.error(
                new TypeError("terminated", {
                  cause: { code: "UND_ERR_SOCKET" },
                }),
              );
            },
          });
          return new HttpResponse(cut, {
            headers: { "Content-Type": "application/json" },
          });
        }
        return HttpResponse.json(mockLatestPrice);
      }),
    );
    const result = await client.getLatestPrice("test-token", undefined, [1]);
    expect(calls).toBe(2);
    expect(result.data).toHaveLength(1);
  });

  it("retries when the body read times out after the headers arrive", async () => {
    let calls = 0;
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, () => {
        calls++;
        if (calls === 1) {
          // Part of the body, then the request's timeout fires. msw does not
          // tie the mocked body to the fetch signal, so fail it directly.
          const stalled = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"parsed":'));
              controller.error(
                new DOMException("The operation timed out.", "TimeoutError"),
              );
            },
          });
          return new HttpResponse(stalled, {
            headers: { "Content-Type": "application/json" },
          });
        }
        return HttpResponse.json(mockLatestPrice);
      }),
    );

    const result = await client.getLatestPrice("test-token", undefined, [1]);
    expect(calls).toBe(2);
    expect(result.data).toHaveLength(1);
  });
});

describe("key check", () => {
  const client = new RouterClient(config, logger);

  /** Router answers each key with the given status; counts probes. */
  function routerAnswers(statusByToken: Record<string, number>) {
    const probes: string[] = [];
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
        const token = (request.headers.get("Authorization") ?? "").replace(
          "Bearer ",
          "",
        );
        probes.push(token);
        body = (await request.json()) as Record<string, unknown>;
        const status = statusByToken[token] ?? 500;
        return status === 200
          ? HttpResponse.json(mockLatestPrice)
          : new HttpResponse("invalid API key", { status });
      }),
    );
    return { body: () => body, probes };
  }

  const verify = (token: string) =>
    verifyKeyWithRouter(client, ROUTER_URL, token, logger);

  it("probes with one property of one feed on the slowest channel", async () => {
    const router = routerAnswers({ good: 200 });
    await verify("good");
    expect(router.body()).toMatchObject({
      channel: "fixed_rate@1000ms",
      priceFeedIds: [1],
      properties: ["exponent"],
    });
  });

  it("accepts a valid key once per TTL", async () => {
    const router = routerAnswers({ good: 200 });
    await verify("good");
    await verify("good");
    expect(router.probes).toEqual(["good"]);
  });

  it("accepts a valid key that is not entitled to the probe feed (403)", async () => {
    routerAnswers({ limited: 403 });
    await expect(verify("limited")).resolves.toBeUndefined();
  });

  it("rejects a made-up key with 401 and remembers it", async () => {
    const router = routerAnswers({ fake: 401 });
    await expect(verify("fake")).rejects.toMatchObject({ status: 401 });
    await expect(verify("fake")).rejects.toMatchObject({ status: 401 });
    expect(router.probes).toEqual(["fake"]);
  });

  it("lets calls through when the Router is down, probing once a minute", async () => {
    const router = routerAnswers({});
    await expect(verify("any")).resolves.toBeUndefined();
    await expect(verify("any")).resolves.toBeUndefined();
    expect(router.probes).toEqual(["any"]);
  });

  it("gives up on a hanging Router after ~2 s, not the request timeout", async () => {
    server.use(
      http.post(`${ROUTER_URL}/v1/latest_price`, async ({ request }) => {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 30_000);
          request.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        return HttpResponse.json(mockLatestPrice);
      }),
    );
    const slowClient = new RouterClient(
      { ...config, requestTimeoutMs: 10_000 },
      logger,
    );
    const started = Date.now();
    await expect(
      verifyKeyWithRouter(slowClient, ROUTER_URL, "any", logger),
    ).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(4000);
  }, 10_000);
});
