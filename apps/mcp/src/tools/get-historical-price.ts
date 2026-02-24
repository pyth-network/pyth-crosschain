import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import { ErrorMessages, toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";
import {
  alignTimestampToChannel,
  normalizeTimestampToMicroseconds,
} from "../utils/timestamp.js";
import { channelParam } from "./schemas.js";

const GetHistoricalPriceInput = {
  channel: channelParam,
  price_feed_ids: z
    .array(z.coerce.number().int().positive())
    .max(50)
    .optional()
    .describe("Numeric feed IDs from get_symbols"),
  symbols: z
    .array(z.string())
    .max(50)
    .optional()
    .describe(
      "Full symbol names from get_symbols including asset type prefix (e.g. ['Crypto.BTC/USD', 'Equity.US.AAPL/USD'])",
    ),
  timestamp: z.coerce
    .number()
    .positive()
    .describe(
      "Unix timestamp — accepts seconds, milliseconds, or microseconds (auto-detected by magnitude)",
    ),
};

export function registerGetHistoricalPrice(
  server: McpServer,
  config: Config,
  historyClient: HistoryClient,
  logger: Logger,
): void {
  server.registerTool(
    "get_historical_price",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description: `Get price data for specific feeds at a historical timestamp. Use get_symbols first to find feed IDs or symbols. Accepts Unix seconds, milliseconds, or microseconds (auto-detected). Historical data is available from April 2025 onward — do not request timestamps before that. For reference, the current server time is Unix ${Math.floor(Date.now() / 1000)} seconds. The timestamp is internally converted to microseconds and aligned (rounded down) to the channel rate — e.g. for fixed_rate@200ms, it must be divisible by 200,000\u03BCs. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_price fields are included for convenience.`,
      inputSchema: GetHistoricalPriceInput,
    },
    async (params) => {
      const start = Date.now();

      if (
        !(params.price_feed_ids?.length ?? 0) &&
        !(params.symbols?.length ?? 0)
      ) {
        logToolCall(
          logger,
          "get_historical_price",
          "error",
          Date.now() - start,
          false,
          "validation",
        );
        return toolError(
          "At least one of 'price_feed_ids' or 'symbols' is required",
        );
      }

      const channel = resolveChannel(params.channel, config);

      try {
        // Resolve symbols to IDs
        let ids = params.price_feed_ids ? [...params.price_feed_ids] : [];
        if ((params.symbols?.length ?? 0) > 0) {
          const allFeeds = await historyClient.getSymbols();
          for (const symbol of params.symbols ?? []) {
            const feed = allFeeds.find((f) => f.symbol === symbol);
            if (!feed) {
              logToolCall(
                logger,
                "get_historical_price",
                "error",
                Date.now() - start,
                false,
                "not_found",
              );
              return toolError(ErrorMessages.FEED_NOT_FOUND(symbol));
            }
            ids.push(feed.pyth_lazer_id);
          }
        }

        // Deduplicate
        ids = [...new Set(ids)];

        const timestampUs = alignTimestampToChannel(
          normalizeTimestampToMicroseconds(params.timestamp),
          channel,
        );

        const prices = await historyClient.getHistoricalPrice(
          channel,
          ids,
          timestampUs,
        );

        const enriched = prices.map((p) => addDisplayPrices(p));

        logToolCall(
          logger,
          "get_historical_price",
          "success",
          Date.now() - start,
          false,
        );

        if (enriched.length === 0) {
          return {
            content: [
              {
                text: JSON.stringify({
                  hint: "No price data found for these feeds at the requested timestamp. Data is available from April 2025 onward. Try a more recent timestamp — some feeds may have started publishing after April 2025.",
                  prices: [],
                }),
                type: "text" as const,
              },
            ],
          };
        }

        return {
          content: [{ text: JSON.stringify(enriched), type: "text" as const }],
        };
      } catch (err) {
        logger.warn({ err }, "get_historical_price upstream error");
        logToolCall(
          logger,
          "get_historical_price",
          "error",
          Date.now() - start,
          false,
          "upstream",
        );
        return toolError("Failed to fetch historical price. Please try again.");
      }
    },
  );
}
