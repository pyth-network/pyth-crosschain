import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import { HttpError } from "../clients/retry.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import type { SessionContext } from "../server.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import { ErrorMessages, toolError } from "../utils/errors.js";
import {
  computeTokenHash,
  getApiKeyLast4,
  logToolCall,
} from "../utils/logger.js";

const GetLatestPriceInput = {
  access_token: z
    .string()
    .trim()
    .min(1, "access_token must not be empty")
    .describe("Pyth Pro access token. Get one at https://pyth.network/pricing"),
  channel: z
    .string()
    .regex(
      /^(real_time|fixed_rate@\d+ms)$/,
      "Invalid channel format. Valid: real_time, fixed_rate@50ms, fixed_rate@200ms, fixed_rate@1000ms",
    )
    .optional()
    .describe(
      "Override default channel (e.g. fixed_rate@200ms, real_time, fixed_rate@50ms, fixed_rate@1000ms)",
    ),
  price_feed_ids: z
    .array(z.coerce.number().int().positive())
    .max(100)
    .optional()
    .describe("Numeric feed IDs from get_symbols"),
  properties: z
    .array(z.string())
    .optional()
    .describe(
      "Properties to return. Default: price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount",
    ),
  symbols: z
    .array(z.string())
    .max(100)
    .optional()
    .describe(
      "Full symbol names from get_symbols including asset type prefix (e.g. ['Crypto.BTC/USD', 'Equity.US.AAPL/USD'])",
    ),
};

export function registerGetLatestPrice(
  server: McpServer,
  config: Config,
  routerClient: RouterClient,
  logger: Logger,
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "get_latest_price",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description:
        "Get the most recent real-time price for one or more feeds. Requires an `access_token` parameter (get one at https://docs.pyth.network/price-feeds/pro/acquire-access-token). Use get_symbols first to find symbols or feed IDs. IMPORTANT: symbols must be the full name including asset type prefix (e.g. 'Crypto.BTC/USD', not 'BTC/USD'). If both price_feed_ids and symbols are provided, only price_feed_ids are used. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_price fields are included for convenience.",
      inputSchema: GetLatestPriceInput,
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();

      // The Router API rejects requests with both symbols and priceFeedIds.
      // When both are provided, prefer price_feed_ids and ignore symbols.
      const effectiveSymbols =
        (params.price_feed_ids?.length ?? 0) > 0 ? undefined : params.symbols;
      const effectiveCount =
        (effectiveSymbols?.length ?? 0) + (params.price_feed_ids?.length ?? 0);

      const baseMetrics = {
        apiKeyLast4: getApiKeyLast4(params.access_token),
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        numFeedsRequested: effectiveCount,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: computeTokenHash(params.access_token),
        tool: "get_latest_price" as const,
      };

      if (effectiveCount === 0) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(
          "At least one of 'symbols' or 'price_feed_ids' is required",
        );
      }

      if (effectiveCount > 100) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(
          "Combined total of symbols and price_feed_ids must not exceed 100",
        );
      }

      const channel = resolveChannel(params.channel, config);

      try {
        const { data: feeds, upstreamLatencyMs } =
          await routerClient.getLatestPrice(
            params.access_token,
            effectiveSymbols,
            params.price_feed_ids,
            params.properties,
            channel,
          );

        const enriched = feeds.map((f) => addDisplayPrices(f));
        const responseText = JSON.stringify(enriched);

        logToolCall(logger, {
          ...baseMetrics,
          latencyMs: Date.now() - start,
          numFeedsReturned: enriched.length,
          responseSizeBytes: Buffer.byteLength(responseText),
          status: "success",
          upstreamLatencyMs,
        });
        return {
          content: [{ text: responseText, type: "text" as const }],
        };
      } catch (err) {
        const errorType =
          err instanceof HttpError && err.status === 403 ? "auth" : "upstream";

        logToolCall(logger, {
          ...baseMetrics,
          errorType,
          latencyMs: Date.now() - start,
          status: "error",
        });

        if (err instanceof HttpError && err.status === 403) {
          return toolError(ErrorMessages.INVALID_TOKEN);
        }

        logger.warn({ err }, "get_latest_price upstream error");
        return toolError("Failed to fetch latest price. Please try again.");
      }
    },
  );
}
