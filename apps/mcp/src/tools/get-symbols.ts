import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { ASSET_TYPES } from "../constants.js";
import { toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";

const GetSymbolsInput = {
  asset_type: z
    .enum(ASSET_TYPES)
    .optional()
    .describe(
      "Filter by asset type: crypto, fx, equity, metal, rates, commodity, funding-rate",
    ),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Results per page (default 50, max 200)"),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Pagination offset (default 0)"),
  query: z
    .string()
    .optional()
    .describe("Text filter (e.g. 'BTC', 'gold', 'AAPL')"),
};

export function registerGetSymbols(
  server: McpServer,
  _config: Config,
  historyClient: HistoryClient,
  logger: Logger,
): void {
  server.registerTool(
    "get_symbols",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description:
        "List available Pyth Pro price feeds. Use this FIRST to discover what feeds exist before calling get_latest_price, get_historical_price, or get_candlestick_data. Filter by asset_type (crypto, equity, fx, metal, rates, commodity, funding-rate) or search by name/symbol. Returns feed metadata including pyth_lazer_id (needed for get_historical_price), symbol, asset_type, and exponent.",
      inputSchema: GetSymbolsInput,
    },
    async (params) => {
      const start = Date.now();
      try {
        let feeds = await historyClient.getSymbols(
          undefined,
          params.asset_type,
        );

        const q = params.query?.trim().toLowerCase();
        if (q) {
          feeds = feeds.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.symbol.toLowerCase().includes(q) ||
              f.description.toLowerCase().includes(q),
          );
        }

        const totalAvailable = feeds.length;
        const offset = params.offset;
        const limit = params.limit;
        const page = feeds.slice(offset, offset + limit);
        const hasMore = offset + limit < totalAvailable;

        const result = {
          count: page.length,
          feeds: page,
          has_more: hasMore,
          next_offset: hasMore ? offset + limit : null,
          offset,
          total_available: totalAvailable,
        };

        logToolCall(
          logger,
          "get_symbols",
          "success",
          Date.now() - start,
          false,
        );
        return {
          content: [{ text: JSON.stringify(result), type: "text" as const }],
        };
      } catch (err) {
        logger.warn({ err }, "get_symbols upstream error");
        logToolCall(
          logger,
          "get_symbols",
          "error",
          Date.now() - start,
          false,
          "upstream",
        );
        return toolError("Failed to fetch symbols. Please try again.");
      }
    },
  );
}
