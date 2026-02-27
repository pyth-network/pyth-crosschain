import type { Logger } from "pino";
import type { Config } from "../config.js";
import { HttpError, parseRetryAfter, withSingleRetry } from "./retry.js";
import type { Feed, HistoricalPriceResponse, OHLCResponse } from "./types.js";
import {
  FeedArraySchema,
  HistoricalPriceArraySchema,
  OHLCResponseSchema,
} from "./types.js";

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

  getSymbols(query?: string, assetType?: string): Promise<Feed[]> {
    const url = new URL("/v1/symbols", this.baseUrl);
    if (query) url.searchParams.set("query", query);
    if (assetType) url.searchParams.set("asset_type", assetType);

    return withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "GET symbols");
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new HttpError(
          res.status,
          `History API /v1/symbols returned ${res.status}`,
          parseRetryAfter(res),
        );
      }
      return FeedArraySchema.parse(await res.json());
    });
  }

  getCandlestickData(
    channel: string,
    symbol: string,
    resolution: string,
    from: number,
    to: number,
  ): Promise<OHLCResponse> {
    const url = new URL(`/v1/${channel}/history`, this.baseUrl);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("resolution", resolution);
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(to));

    return withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "GET candlestick data");
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new HttpError(
          res.status,
          `History API /${channel}/history returned ${res.status}`,
          parseRetryAfter(res),
        );
      }
      return OHLCResponseSchema.parse(await res.json());
    });
  }

  getHistoricalPrice(
    channel: string,
    ids: number[],
    timestampUs: number,
  ): Promise<HistoricalPriceResponse[]> {
    const url = new URL(`/v1/${channel}/price`, this.baseUrl);
    for (const id of ids) {
      url.searchParams.append("ids", String(id));
    }
    url.searchParams.set("timestamp", String(timestampUs));

    return withSingleRetry(async () => {
      this.logger.debug({ url: url.toString() }, "GET historical price");
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new HttpError(
          res.status,
          `History API /${channel}/price returned ${res.status}`,
          parseRetryAfter(res),
        );
      }
      return HistoricalPriceArraySchema.parse(await res.json());
    });
  }
}
