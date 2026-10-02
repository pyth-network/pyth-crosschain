import type { Logger } from "pino";
import type { Config } from "../config.js";
import { HttpError, parseRetryAfter, withSingleRetry } from "./retry.js";
import type { LatestPriceParsedFeed } from "./types.js";

type Channel = "real_time" | `fixed_rate@${number}ms`;
type PriceFeedProperty =
  | "price"
  | "bestBidPrice"
  | "bestAskPrice"
  | "exponent"
  | "publisherCount"
  | "confidence";

const DEFAULT_PROPERTIES: PriceFeedProperty[] = [
  "price",
  "bestBidPrice",
  "bestAskPrice",
  "exponent",
  "publisherCount",
  "confidence",
];
const CHANNEL_PATTERN = /^(real_time|fixed_rate@\d+ms)$/;
const DEFAULT_PROPERTY_SET: ReadonlySet<string> = new Set(DEFAULT_PROPERTIES);

export type UpstreamResult<T> = {
  data: T;
  upstreamLatencyMs: number;
};

type ParsedPayload = {
  timestampUs: string | number;
  priceFeeds: Record<string, unknown>[];
};

export class RouterClient {
  private readonly priceServiceUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultChannel: string;

  constructor(
    config: Config,
    private readonly logger: Logger,
  ) {
    this.priceServiceUrl = config.routerUrl;
    this.timeoutMs = config.requestTimeoutMs;
    this.defaultChannel = config.channel;
  }

  async getLatestPrice(
    token: string,
    symbols?: string[],
    priceFeedIds?: number[],
    properties?: string[],
    channel?: string,
  ): Promise<UpstreamResult<LatestPriceParsedFeed[]>> {
    const url = new URL("/v1/latest_price", this.priceServiceUrl);
    const effectiveChannel = channel ?? this.defaultChannel;
    // Signed/binary payloads are never returned to callers, so request none.
    const body = JSON.stringify({
      channel: normalizeChannel(effectiveChannel),
      formats: [],
      parsed: true,
      priceFeedIds: (priceFeedIds?.length ?? 0) > 0 ? priceFeedIds : undefined,
      properties: normalizeProperties(properties),
      symbols: (symbols?.length ?? 0) > 0 ? symbols : undefined,
    });

    const fetchStart = Date.now();
    const parsed = await withSingleRetry(async () => {
      this.logger.debug(
        { channel: effectiveChannel, priceFeedIds, symbols },
        "POST latest_price",
      );
      const res = await fetch(url, {
        body,
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
      return parseLatestPriceBody(res);
    });

    const upstreamLatencyMs = Date.now() - fetchStart;
    return { data: normalizeFeeds(parsed), upstreamLatencyMs };
  }
}

// --- helpers (private to module) ---

async function parseLatestPriceBody(res: Response): Promise<ParsedPayload> {
  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new HttpError(
      502,
      `Router API returned malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const parsed = (json as { parsed?: ParsedPayload | null } | null)?.parsed;
  if (!parsed || !Array.isArray(parsed.priceFeeds)) {
    throw new HttpError(502, "Router API returned no parsed data");
  }
  return parsed;
}

function isChannel(value: string): value is Channel {
  return CHANNEL_PATTERN.test(value);
}

function normalizeChannel(channel: string): Channel {
  if (isChannel(channel)) return channel;
  throw new HttpError(400, `Invalid channel: ${channel}`);
}

function isPriceFeedProperty(value: string): value is PriceFeedProperty {
  return DEFAULT_PROPERTY_SET.has(value);
}

function normalizeProperties(properties?: string[]): PriceFeedProperty[] {
  if (!properties || properties.length === 0) return DEFAULT_PROPERTIES;
  const normalized = properties.filter(isPriceFeedProperty);
  if (normalized.length === properties.length) return normalized;
  const invalid = properties.find((property) => !isPriceFeedProperty(property));
  throw new HttpError(400, `Invalid price property: ${invalid ?? "unknown"}`);
}

/** Convert camelCase API response to snake_case internal format with numeric values */
function normalizeFeeds(parsed: ParsedPayload): LatestPriceParsedFeed[] {
  const timestampUs =
    typeof parsed.timestampUs === "string"
      ? Number(parsed.timestampUs)
      : parsed.timestampUs;

  if (!Number.isFinite(timestampUs)) {
    throw new HttpError(502, "Invalid timestampUs from upstream");
  }

  return parsed.priceFeeds.map((raw) => {
    const priceFeedId = raw.priceFeedId;
    if (typeof priceFeedId !== "number" || !Number.isFinite(priceFeedId)) {
      throw new HttpError(502, "Invalid priceFeedId from upstream");
    }

    const feed: LatestPriceParsedFeed = {
      price_feed_id: priceFeedId,
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
