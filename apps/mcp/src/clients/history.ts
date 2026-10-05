import type { Logger } from "pino";
import { z } from "zod";
import type { Config } from "../config.js";
import { httpErrorFromResponse, withSingleRetry } from "./retry.js";
import type { UpstreamResult } from "./router.js";
import {
  entitledIdsCache,
  symbolsCache,
  symbolsCacheKey,
} from "./symbols-store.js";
import type {
  Feed,
  HistoricalPriceResponse,
  OHLCResponse,
  PriceList,
} from "./types.js";
import {
  FeedIdArraySchema,
  FeedSchema,
  HistoricalPriceArraySchema,
  OHLCResponseSchema,
  PriceListSchema,
} from "./types.js";

/**
 * Bearer auth header for History endpoints. Returns undefined when no token
 * is set so unauthenticated callers are unchanged.
 */
function authHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export class HistoryClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    config: Config,
    private readonly logger: Logger,
  ) {
    this.baseUrl = config.historyUrl;
    this.timeoutMs = config.requestTimeoutMs;
  }

  /**
   * Fetch the symbol catalog, cached per token for a few minutes. With a
   * token the API also returns feeds that are hidden from anonymous callers.
   * Filtering (query, asset type, ...) is done by callers on the full list.
   */
  async getSymbols(token?: string): Promise<UpstreamResult<Feed[]>> {
    const key = symbolsCacheKey(this.baseUrl, token, "all");
    const fetchStart = Date.now();
    const { hit, value } = await symbolsCache.getOrLoad(key, () =>
      this.fetchSymbols(token),
    );
    return {
      data: value,
      upstreamLatencyMs: hit ? 0 : Date.now() - fetchStart,
    };
  }

  /**
   * IDs of the feeds this token can query right now
   * (`/v1/symbols?entitled_only=true`), cached per token.
   */
  async getEntitledFeedIds(
    token: string,
  ): Promise<UpstreamResult<ReadonlySet<number>>> {
    const key = symbolsCacheKey(this.baseUrl, token, "entitled");
    const fetchStart = Date.now();
    const { hit, value } = await entitledIdsCache.getOrLoad(key, async () => {
      const feeds = await this.fetchSymbolsJson(token, true);
      return new Set(
        FeedIdArraySchema.parse(feeds).map((f) => f.pyth_lazer_id),
      );
    });
    return {
      data: value,
      upstreamLatencyMs: hit ? 0 : Date.now() - fetchStart,
    };
  }

  /**
   * Validate the catalog one feed at a time: a single feed that drifts from
   * the schema is dropped (and logged) instead of failing the whole list.
   */
  private async fetchSymbols(token?: string): Promise<Feed[]> {
    const rows = z
      .array(z.unknown())
      .parse(await this.fetchSymbolsJson(token, false));
    const feeds: Feed[] = [];
    const dropped: unknown[] = [];
    for (const row of rows) {
      const result = FeedSchema.safeParse(row);
      if (result.success) feeds.push(result.data);
      else dropped.push((row as { pyth_lazer_id?: unknown })?.pyth_lazer_id);
    }
    if (dropped.length > 0) {
      this.logger.warn(
        { count: dropped.length, ids: dropped.slice(0, 20) },
        "dropped symbols that do not match the expected schema",
      );
    }
    return feeds;
  }

  private fetchSymbolsJson(
    token: string | undefined,
    entitledOnly: boolean,
  ): Promise<unknown> {
    const url = new URL("/v1/symbols", this.baseUrl);
    if (entitledOnly) url.searchParams.set("entitled_only", "true");
    return withSingleRetry(async () => {
      this.logger.debug(
        { authenticated: token !== undefined, url: url.toString() },
        "GET symbols",
      );
      const res = await fetch(url, {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw await httpErrorFromResponse(
          res,
          `History API /v1/symbols returned ${res.status}`,
        );
      }
      return res.json() as Promise<unknown>;
    });
  }

  async getCandlestickData(
    channel: string,
    symbol: string,
    resolution: string,
    from: number,
    to: number,
    token?: string,
  ): Promise<UpstreamResult<OHLCResponse>> {
    const url = new URL(`/v1/${channel}/history`, this.baseUrl);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("resolution", resolution);
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(to));

    const fetchStart = Date.now();
    const data = await withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "GET candlestick data");
      const res = await fetch(url, {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw await httpErrorFromResponse(
          res,
          `History API /${channel}/history returned ${res.status}`,
        );
      }
      return OHLCResponseSchema.parse(await res.json());
    });
    const upstreamLatencyMs = Date.now() - fetchStart;
    return { data, upstreamLatencyMs };
  }

  async getHistoricalPrice(
    channel: string,
    ids: number[],
    timestampUs: number,
    token?: string,
  ): Promise<UpstreamResult<HistoricalPriceResponse[]>> {
    const url = new URL(`/v1/${channel}/price`, this.baseUrl);
    for (const id of ids) {
      url.searchParams.append("ids", String(id));
    }
    url.searchParams.set("timestamp", String(timestampUs));

    const fetchStart = Date.now();
    const data = await withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "GET historical price");
      const res = await fetch(url, {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw await httpErrorFromResponse(
          res,
          `History API /${channel}/price returned ${res.status}`,
        );
      }
      return HistoricalPriceArraySchema.parse(await res.json());
    });
    const upstreamLatencyMs = Date.now() - fetchStart;
    return { data, upstreamLatencyMs };
  }

  /**
   * Every price update for the given feeds within [startUs, endUs]
   * (inclusive, at most 60 s apart), one page at a time. Pass the previous
   * page's `next` as `after` to continue.
   */
  async getPriceRange(
    channel: string,
    ids: number[],
    startUs: number,
    endUs: number,
    options: { after?: string; limit?: number; token?: string } = {},
  ): Promise<UpstreamResult<PriceList>> {
    const url = new URL(`/v1/${channel}/price/range`, this.baseUrl);
    for (const id of ids) {
      url.searchParams.append("ids", String(id));
    }
    url.searchParams.set("start_timestamp", String(startUs));
    url.searchParams.set("end_timestamp", String(endUs));
    if (options.limit !== undefined) {
      url.searchParams.set("limit", String(options.limit));
    }
    if (options.after) url.searchParams.set("after", options.after);

    const fetchStart = Date.now();
    const data = await withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "GET price range");
      const res = await fetch(url, {
        headers: authHeaders(options.token),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw await httpErrorFromResponse(
          res,
          `History API /${channel}/price/range returned ${res.status}`,
        );
      }
      return PriceListSchema.parse(await res.json());
    });
    const upstreamLatencyMs = Date.now() - fetchStart;
    return { data, upstreamLatencyMs };
  }
}
