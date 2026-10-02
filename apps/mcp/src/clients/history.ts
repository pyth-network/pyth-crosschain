import type { Logger } from "pino";
import type { Config } from "../config.js";
import { httpErrorFromResponse, withSingleRetry } from "./retry.js";
import type { UpstreamResult } from "./router.js";
import {
  entitledIdsCache,
  symbolsCache,
  symbolsCacheKey,
} from "./symbols-store.js";
import type { Feed, HistoricalPriceResponse, OHLCResponse } from "./types.js";
import {
  FeedArraySchema,
  FeedIdArraySchema,
  HistoricalPriceArraySchema,
  OHLCResponseSchema,
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

  private async fetchSymbols(token?: string): Promise<Feed[]> {
    return FeedArraySchema.parse(await this.fetchSymbolsJson(token, false));
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
}
