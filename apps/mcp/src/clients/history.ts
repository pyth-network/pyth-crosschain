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

/** Bearer auth header, or none without a token. */
function authHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export type HistoryClientOptions = {
  /** Throws (401) to stop a catalog download for a rejected key. */
  verifyKey?: (token: string) => Promise<void>;
};

export class HistoryClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    config: Config,
    private readonly logger: Logger,
    private readonly options: HistoryClientOptions = {},
  ) {
    this.baseUrl = config.historyUrl;
    this.timeoutMs = config.requestTimeoutMs;
  }

  /** The symbol catalog for this token, cached; callers filter it. */
  async getSymbols(token?: string): Promise<UpstreamResult<Feed[]>> {
    const key = symbolsCacheKey(this.baseUrl, token, "all");
    const fetchStart = Date.now();
    const { hit, value } = await symbolsCache.getOrLoad(key, async () => {
      if (token) await this.options.verifyKey?.(token);
      return this.fetchSymbols(token);
    });
    return {
      data: value,
      upstreamLatencyMs: hit ? 0 : Date.now() - fetchStart,
    };
  }

  /** IDs of the feeds this token can query now (`entitled_only`), cached. */
  async getEntitledFeedIds(
    token: string,
  ): Promise<UpstreamResult<ReadonlySet<number>>> {
    const key = symbolsCacheKey(this.baseUrl, token, "entitled");
    const fetchStart = Date.now();
    const { hit, value } = await entitledIdsCache.getOrLoad(key, async () => {
      await this.options.verifyKey?.(token);
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

  /** Validated feed by feed: a drifted feed is dropped and logged. */
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

  /** One page of updates in [startUs, endUs]; pass `next` as `after`. */
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
