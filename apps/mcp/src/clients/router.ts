import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import type { Channel, PriceFeedProperty } from "@pythnetwork/pyth-lazer-sdk";
import type { Logger } from "pino";
import type { Config } from "../config.js";
import { HttpError, withSingleRetry } from "./retry.js";
import type { LatestPriceParsedFeed } from "./types.js";

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
    // Lightweight — no WebSocket pool, just stores config values
    const client = await PythLazerClient.create({
      priceServiceUrl: this.priceServiceUrl,
      token,
    });

    const effectiveChannel = channel ?? this.defaultChannel;
    this.logger.debug(
      { channel: effectiveChannel, priceFeedIds, symbols },
      "SDK getLatestPrice",
    );

    const fetchStart = Date.now();
    const response = await withSingleRetry(async () => {
      try {
        const normalizedChannel = normalizeChannel(effectiveChannel);
        const normalizedProperties = normalizeProperties(properties);
        return await withTimeout(
          client.getLatestPrice({
            channel: normalizedChannel,
            formats: ["leUnsigned"],
            priceFeedIds:
              (priceFeedIds?.length ?? 0) > 0 ? priceFeedIds : undefined,
            properties: normalizedProperties,
            symbols: (symbols?.length ?? 0) > 0 ? symbols : undefined,
          }),
          this.timeoutMs,
        );
      } catch (err) {
        throw toHttpError(err);
      }
    });

    if (!response.parsed) {
      throw new HttpError(502, "SDK returned no parsed data");
    }

    const upstreamLatencyMs = Date.now() - fetchStart;
    return { data: normalizeFeeds(response.parsed), upstreamLatencyMs };
  }
}

// --- helpers (private to module) ---

/**
 * Race a promise against a timeout. On timeout, reject locally.
 *
 * Note: The SDK does not support AbortSignal, so the underlying fetch
 * continues in the background after a timeout. This is an accepted
 * limitation — the local rejection unblocks the caller and retry logic.
 * Follow-up: add AbortSignal support to the Pyth Lazer SDK.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DOMException("Request timed out", "TimeoutError")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Convert SDK errors to types our retry/error handling understands.
 *
 * SDK wraps ALL thrown errors as: "Failed to fetch latest price: <inner>"
 * where <inner> is either:
 *   - "HTTP error! status: 403 - Unauthorized" (HTTP errors)
 *   - "fetch failed" / "network ..." (network errors — retryable)
 *   - anything else (JSON parse errors, etc. — not retryable)
 */
function toHttpError(err: unknown): Error {
  if (err instanceof DOMException) return err; // timeout — handled by isRetryable
  if (err instanceof HttpError) return err; // already converted
  if (err instanceof Error) {
    const status = extractHttpStatusFromMessage(err.message);
    if (status != null) return new HttpError(status, err.message);
    // Network-level failure — re-wrap as TypeError so isRetryable matches
    if (/fetch failed|network|ECONNREFUSED|ENOTFOUND/i.test(err.message)) {
      return new TypeError(err.message);
    }
  }
  // Unknown/unparseable error — fail closed as 502
  return new HttpError(502, err instanceof Error ? err.message : String(err));
}

export function extractHttpStatusFromMessage(message: string): number | undefined {
  const statusPatterns = [
    /status[:=]\s*(\d{3})/i,
    /http(?:\s+error)?\D+(\d{3})/i,
    /\b([45]\d{2})\b/,
  ];

  for (const pattern of statusPatterns) {
    const match = message.match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (parsed >= 400 && parsed <= 599) return parsed;
  }
  return undefined;
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
function normalizeFeeds(parsed: {
  timestampUs: string | number;
  priceFeeds: Record<string, unknown>[];
}): LatestPriceParsedFeed[] {
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
