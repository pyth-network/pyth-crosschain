import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { ASSET_TYPES } from "../constants.js";
import type { SessionContext } from "../server.js";
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
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "get_symbols",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description:
        "List available Pyth Pro price feeds. Use this FIRST to discover what feeds exist before calling get_latest_price, get_historical_price, or get_candlestick_data. Filter by asset_type (crypto, equity, fx, metal, rates, commodity, funding-rate) or search by name/symbol. Returns feed metadata including pyth_lazer_id (needed for get_historical_price), symbol, asset_type, and exponent.",
      inputSchema: GetSymbolsInput,
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();

      const baseMetrics = {
        apiKeyLast4: null as null,
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: null as null,
        tool: "get_symbols" as const,
      };

      try {
        const { data: feeds, upstreamLatencyMs } =
          await historyClient.getSymbols(undefined, params.asset_type);

        let filtered = feeds;
        const q = params.query?.trim().toLowerCase();
        if (q) {
          filtered = feeds.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.symbol.toLowerCase().includes(q) ||
              f.description.toLowerCase().includes(q),
          );
        }

        const totalAvailable = filtered.length;
        const offset = params.offset;
        const limit = params.limit;
        const page = filtered.slice(offset, offset + limit);
        const hasMore = offset + limit < totalAvailable;

        const result = {
          count: page.length,
          feeds: page,
          has_more: hasMore,
          next_offset: hasMore ? offset + limit : null,
          offset,
          total_available: totalAvailable,
        };

        const responseText = JSON.stringify(result);

        logToolCall(logger, {
          ...baseMetrics,
          latencyMs: Date.now() - start,
          numFeedsReturned: page.length,
          responseSizeBytes: Buffer.byteLength(responseText),
          status: "success",
          upstreamLatencyMs,
        });
        return {
          content: [{ text: responseText, type: "text" as const }],
        };
      } catch (err) {
        logger.warn({ err }, "get_symbols upstream error");
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError("Failed to fetch symbols. Please try again.");
      }
    },
  );
}
