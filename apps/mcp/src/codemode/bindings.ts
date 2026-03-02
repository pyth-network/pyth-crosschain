/**
 * Code Mode bindings — maps codemode.* calls to Pyth API handlers.
 * get_latest_price receives server-injected token; model never sees it.
 */

import type { HistoryClient } from "../clients/history.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import { ASSET_TYPES, RESOLUTIONS } from "../constants.js";
import type { Logger } from "pino";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import {
  alignTimestampToChannel,
  normalizeTimestampToMicroseconds,
} from "../utils/timestamp.js";

export type BindingContext = {
  config: Config;
  historyClient: HistoryClient;
  routerClient: RouterClient;
  logger: Logger;
  /** Server-managed token for get_latest_price. Injected server-side only. */
  serverToken: string | undefined;
};

/** Copy out isolate-held values (handles ivm.Reference) */
function unwrapArg<T>(arg: unknown): T {
  if (arg == null) return arg as T;
  const ref = arg as { copy?: () => T };
  if (typeof ref.copy === "function") return ref.copy() as T;
  return arg as T;
}

export function createBindings(ctx: BindingContext): Record<
  string,
  (arg: unknown) => Promise<unknown>
> {
  const { config, historyClient, routerClient, logger, serverToken } = ctx;

  return {
    async get_symbols(arg: unknown) {
      const p = unwrapArg<{
        query?: string;
        asset_type?: string;
        limit?: number;
        offset?: number;
      }>(arg);
      const asset_type = p?.asset_type;
      const limit = Math.min(
        200,
        Math.max(1, p?.limit ?? 50),
      );
      const offset = Math.max(0, p?.offset ?? 0);

      const { data: feeds } = await historyClient.getSymbols(
        undefined,
        asset_type && ASSET_TYPES.includes(asset_type) ? asset_type : undefined,
      );

      let filtered = feeds;
      const q = (p?.query ?? "").trim().toLowerCase();
      if (q) {
        filtered = feeds.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.symbol.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q),
        );
      }

      const totalAvailable = filtered.length;
      const page = filtered.slice(offset, offset + limit);
      const hasMore = offset + limit < totalAvailable;

      return {
        count: page.length,
        feeds: page,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        offset,
        total_available: totalAvailable,
      };
    },

    async get_historical_price(arg: unknown) {
      const p = unwrapArg<{
        channel?: string;
        price_feed_ids?: number[];
        symbols?: string[];
        timestamp: number;
      }>(arg);

      const effectiveSymbols =
        (p?.price_feed_ids?.length ?? 0) > 0 ? undefined : p?.symbols;
      if (
        !(p?.price_feed_ids?.length ?? 0) &&
        !(effectiveSymbols?.length ?? 0)
      ) {
        throw new Error(
          "At least one of 'price_feed_ids' or 'symbols' is required",
        );
      }

      const channel = resolveChannel(p?.channel, config);
      let ids: number[] = p?.price_feed_ids ? [...p.price_feed_ids] : [];

      if ((effectiveSymbols?.length ?? 0) > 0) {
        const { data: allFeeds } = await historyClient.getSymbols();
        for (const symbol of effectiveSymbols ?? []) {
          const feed = allFeeds.find((f) => f.symbol === symbol);
          if (!feed)
            throw new Error(
              `Feed not found: ${symbol}. Use get_symbols to discover available feeds.`,
            );
          ids.push(feed.pyth_lazer_id);
        }
      }
      ids = [...new Set(ids)];

      const timestampUs = alignTimestampToChannel(
        normalizeTimestampToMicroseconds(p!.timestamp),
        channel,
      );
      const { data: prices } = await historyClient.getHistoricalPrice(
        channel,
        ids,
        timestampUs,
      );
      return prices.map((price) => addDisplayPrices(price));
    },

    async get_candlestick_data(arg: unknown) {
      const p = unwrapArg<{
        channel?: string;
        from: number;
        to: number;
        resolution: string;
        symbol: string;
      }>(arg);

      if (!p?.symbol) throw new Error("symbol is required");
      if (p.from >= p.to) throw new Error("'from' must be before 'to'");

      const resolution = p.resolution;
      if (!RESOLUTIONS.includes(resolution as (typeof RESOLUTIONS)[number])) {
        throw new Error(
          `Invalid resolution. Valid: ${RESOLUTIONS.join(", ")}`,
        );
      }

      const channel = resolveChannel(p.channel, config);
      const { data } = await historyClient.getCandlestickData(
        channel,
        p.symbol,
        resolution,
        p.from,
        p.to,
      );

      if (data.s === "no_data")
        throw new Error(
          "No candlestick data available for the requested range. Try a different time range or symbol.",
        );
      if (data.s === "error")
        throw new Error(data.errmsg ?? "Unknown error from Pyth History API");

      return data;
    },

    async get_latest_price(arg: unknown) {
      const p = unwrapArg<{
        channel?: string;
        price_feed_ids?: number[];
        properties?: string[];
        symbols?: string[];
      }>(arg);

      if (!serverToken) {
        throw new Error(
          "Server is not configured with a Pyth Pro access token. get_latest_price is unavailable.",
        );
      }

      const effectiveSymbols =
        (p?.price_feed_ids?.length ?? 0) > 0 ? undefined : p?.symbols;
      const effectiveCount =
        (effectiveSymbols?.length ?? 0) + (p?.price_feed_ids?.length ?? 0);

      if (effectiveCount === 0) {
        throw new Error(
          "At least one of 'symbols' or 'price_feed_ids' is required",
        );
      }
      if (effectiveCount > 100) {
        throw new Error(
          "Combined total of symbols and price_feed_ids must not exceed 100",
        );
      }

      const channel = resolveChannel(p?.channel, config);
      const { data: feeds } = await routerClient.getLatestPrice(
        serverToken,
        effectiveSymbols,
        p?.price_feed_ids,
        p?.properties,
        channel,
      );
      return feeds.map((f) => addDisplayPrices(f));
    },
  };
}
