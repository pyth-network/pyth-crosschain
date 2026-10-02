import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import { CHANNELS } from "../constants.js";
import type { SessionContext } from "../server.js";
import { resolveAccessToken } from "../utils/auth.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import { authErrorFor, ErrorMessages, toolError } from "../utils/errors.js";
import {
  computeTokenHash,
  getApiKeyLast4,
  logToolCall,
} from "../utils/logger.js";
import { getServerTime } from "../utils/timestamp.js";

const GetLatestPriceInput = {
  access_token: z
    .string()
    .trim()
    .min(1, "access_token must not be empty")
    .optional()
    .describe(
      "Your Pyth Pro access token. Optional when the server was started with PYTH_PRO_ACCESS_TOKEN (local stdio setups); required otherwise. Get one at https://docs.pyth.network/price-feeds/pro/acquire-access-token",
    ),
  channel: z
    .enum(CHANNELS)
    .optional()
    .describe(
      `Override the default channel (update rate): ${CHANNELS.join(", ")}`,
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
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "Get the most recent real-time price for one or more feeds. Requires a Pyth Pro access token: pass `access_token`, unless the server was started with PYTH_PRO_ACCESS_TOKEN. Use get_symbols first to find symbols or feed IDs. IMPORTANT: symbols must be the full name including asset type prefix (e.g. 'Crypto.BTC/USD', not 'BTC/USD'). If both price_feed_ids and symbols are provided, only price_feed_ids are used. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_price fields are included for convenience.",
      inputSchema: GetLatestPriceInput,
      title: "Get Latest Price",
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();
      const token = resolveAccessToken(params.access_token, config);

      // The Router API rejects requests with both symbols and priceFeedIds.
      // When both are provided, prefer price_feed_ids and ignore symbols.
      const effectiveSymbols =
        (params.price_feed_ids?.length ?? 0) > 0 ? undefined : params.symbols;
      const effectiveCount =
        (effectiveSymbols?.length ?? 0) + (params.price_feed_ids?.length ?? 0);

      const baseMetrics = {
        apiKeyLast4: getApiKeyLast4(token),
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        numFeedsRequested: effectiveCount,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: computeTokenHash(token),
        tool: "get_latest_price" as const,
      };

      if (!token) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "missing_token",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(ErrorMessages.MISSING_TOKEN);
      }

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
            token,
            effectiveSymbols,
            params.price_feed_ids,
            params.properties,
            channel,
          );

        const enriched = feeds.map((f) => addDisplayPrices(f));
        const responseText = JSON.stringify({
          prices: enriched,
          ...getServerTime(),
        });

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
        const authError = authErrorFor(err);

        logToolCall(logger, {
          ...baseMetrics,
          errorType: authError?.errorType ?? "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });

        if (authError) return toolError(authError.message);

        logger.warn({ err }, "get_latest_price upstream error");
        return toolError("Failed to fetch latest price. Please try again.");
      }
    },
  );
}
