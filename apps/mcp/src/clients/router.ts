import type { Logger } from "pino";
import type { Config } from "../config.js";
import { HttpError, parseRetryAfter, withSingleRetry } from "./retry.js";
import type { LatestPriceParsedFeed } from "./types.js";
import { LatestPriceResponseSchema } from "./types.js";

const DEFAULT_PROPERTIES = [
  "price",
  "bestBidPrice",
  "bestAskPrice",
  "exponent",
  "publisherCount",
  "confidence",
];

export class RouterClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    config: Config,
    private readonly logger: Logger,
  ) {
    this.baseUrl = config.routerUrl;
    this.timeoutMs = config.requestTimeoutMs;
  }

  async getLatestPrice(
    token: string,
    symbols?: string[],
    priceFeedIds?: number[],
    properties?: string[],
    channel?: string,
  ): Promise<LatestPriceParsedFeed[]> {
    const url = new URL("/v1/latest_price", this.baseUrl);

    const body: Record<string, unknown> = {
      formats: ["leUnsigned"],
      properties:
        (properties?.length ?? 0) > 0 ? properties : DEFAULT_PROPERTIES,
    };
    if ((symbols?.length ?? 0) > 0) body.symbols = symbols;
    if ((priceFeedIds?.length ?? 0) > 0) body.priceFeedIds = priceFeedIds;
    if (channel) body.channel = channel;

    return await withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "POST latest_price");
      const res = await fetch(url, {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        throw new HttpError(
          res.status,
          `Router API /v1/latest_price returned ${res.status}`,
          parseRetryAfter(res),
        );
      }

      const json: unknown = await res.json();
      const data = LatestPriceResponseSchema.parse(json);
      return normalizeFeeds(data.parsed);
    });
  }
}

/** Convert camelCase API response to snake_case internal format with numeric values */
function normalizeFeeds(parsed: {
  timestampUs: string | number;
  priceFeeds: Record<string, unknown>[];
}): LatestPriceParsedFeed[] {
  const timestampUs =
    typeof parsed.timestampUs === "string"
      ? Number(parsed.timestampUs)
      : parsed.timestampUs;

  return parsed.priceFeeds.map((raw) => {
    const feed: LatestPriceParsedFeed = {
      price_feed_id: raw.priceFeedId as number,
      timestamp_us: timestampUs,
    };
    if (raw.price != null) feed.price = Number(raw.price);
    if (raw.bestBidPrice != null)
      feed.best_bid_price = Number(raw.bestBidPrice);
    if (raw.bestAskPrice != null)
      feed.best_ask_price = Number(raw.bestAskPrice);
    if (raw.confidence != null) feed.confidence = Number(raw.confidence);
    if (raw.exponent != null) feed.exponent = raw.exponent as number;
    if (raw.publisherCount != null)
      feed.publisher_count = raw.publisherCount as number;
    return feed;
  });
}
