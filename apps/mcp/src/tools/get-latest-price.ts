import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import { CHANNELS, PRICE_FEED_PROPERTIES } from "../constants.js";
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
import {
  resolvedSymbolsField,
  resolveSymbols,
} from "../utils/resolve-symbols.js";
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
    .array(z.enum(PRICE_FEED_PROPERTIES))
    .optional()
    .describe(
      `Properties to return: ${PRICE_FEED_PROPERTIES.join(", ")}. Default: price, bestBidPrice, bestAskPrice, exponent, publisherCount, confidence, marketSession, feedUpdateTimestamp. Use fundingRate, fundingTimestamp and fundingRateInterval for funding-rate feeds; emaPrice and emaConfidence for the exponential moving average.`,
    ),
  symbols: z
    .array(z.string())
    .max(100)
    .optional()
    .describe(
      "Symbols from get_symbols (e.g. ['Crypto.BTC/USD', 'Equity.US.AAPL/USD']) or bare pairs like 'BTC/USD'",
    ),
};

export function registerGetLatestPrice(
  server: McpServer,
  config: Config,
  historyClient: HistoryClient,
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
        "Get the most recent real-time price for one or more feeds. Requires a Pyth Pro access token: pass `access_token`, unless the server was started with PYTH_PRO_ACCESS_TOKEN. Use get_symbols first to find symbols or feed IDs. Symbols can be full names from get_symbols (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL/USD') or bare pairs like 'BTC/USD'; a bare pair resolves to the single live spot feed, and `resolved_symbols` in the response shows what each input resolved to. Ambiguous inputs return an error listing the candidates. If both price_feed_ids and symbols are provided, only price_feed_ids are used. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_* fields (display_price, display_bid, display_ask, display_confidence, display_ema_price, display_ema_confidence, display_funding_rate) apply the exponent for you.",
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
        // Resolve symbols (including bare pairs like BTC/USD) to feed IDs
        // against the caller's catalog; the Router only accepts full symbols.
        let ids = params.price_feed_ids ?? [];
        let resolvedSymbols: Record<string, string> = {};
        let symbolLookupUpstreamMs = 0;
        if ((effectiveSymbols?.length ?? 0) > 0) {
          const catalog = await historyClient.getSymbols(token);
          symbolLookupUpstreamMs = catalog.upstreamLatencyMs;
          const resolution = resolveSymbols(
            effectiveSymbols ?? [],
            catalog.data,
          );
          if (resolution.errors.length > 0) {
            logToolCall(logger, {
              ...baseMetrics,
              errorType: "not_found",
              latencyMs: Date.now() - start,
              status: "error",
            });
            return toolError(resolution.errors.join("\n"));
          }
          resolvedSymbols = resolution.resolved;
          ids = [...new Set(resolution.feeds.map((f) => f.pyth_lazer_id))];
        }

        const { data: feeds, upstreamLatencyMs: priceUpstreamMs } =
          await routerClient.getLatestPrice(
            token,
            undefined,
            ids,
            params.properties,
            channel,
          );
        const upstreamLatencyMs = symbolLookupUpstreamMs + priceUpstreamMs;

        const enriched = feeds.map((f) => addDisplayPrices(f));
        const responseText = JSON.stringify({
          prices: enriched,
          ...resolvedSymbolsField(resolvedSymbols),
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
