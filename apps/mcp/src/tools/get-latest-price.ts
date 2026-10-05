import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import { HttpError } from "../clients/retry.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import { CHANNELS, PRICE_FEED_PROPERTIES } from "../constants.js";
import type { SessionContext } from "../server.js";
import { accessTokenSchema } from "../utils/access-token.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import {
  authErrorFor,
  ErrorMessages,
  rejectionErrorFor,
  toolError,
} from "../utils/errors.js";
import {
  computeTokenHash,
  getApiKeyLast4,
  logToolCall,
} from "../utils/logger.js";
import { missingFeedsField } from "../utils/missing-feeds.js";
import {
  resolvedSymbolsField,
  resolveSymbols,
  tryGetCatalog,
} from "../utils/resolve-symbols.js";
import { getServerTime } from "../utils/timestamp.js";

const GetLatestPriceInput = {
  access_token: accessTokenSchema(
    "Your Pyth Pro access token. Get one at https://docs.pyth.network/price-feeds/pro/acquire-access-token",
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
        "Get the most recent real-time price for one or more feeds. Requires the user's own Pyth Pro access token as `access_token`. Use get_symbols first to find symbols or feed IDs. Symbols can be full names from get_symbols (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL/USD') or bare pairs like 'BTC/USD'. A bare pair resolves to the live spot feed when there is one, otherwise to the only remaining match (inactive feeds excluded, live preferred over coming_soon), and `resolved_symbols` in the response shows what each input resolved to. Ambiguous inputs return an error listing the candidates. If both price_feed_ids and symbols are provided, only price_feed_ids are used. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_* fields (display_price, display_bid, display_ask, display_confidence, display_ema_price, display_ema_confidence, display_funding_rate) apply the exponent for you.",
      inputSchema: GetLatestPriceInput,
      title: "Get Latest Price",
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();
      const token = params.access_token;

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

      // Set when the catalog is unavailable and symbols go to the Router as is.
      let unresolvedSymbols: string[] | undefined;

      try {
        // Resolve symbols (including bare pairs like BTC/USD) to feed IDs
        // against the caller's catalog; the Router only accepts full symbols.
        // If the catalog is unavailable, send the symbols to the Router as
        // given so full symbols keep working.
        let ids = params.price_feed_ids ?? [];
        let resolvedSymbols: Record<string, string> = {};
        let symbolLookupUpstreamMs = 0;
        const catalog =
          (effectiveSymbols?.length ?? 0) > 0
            ? await tryGetCatalog(historyClient, token, logger, {
                priceFromRouter: true,
              })
            : undefined;
        if ((effectiveSymbols?.length ?? 0) > 0 && !catalog) {
          unresolvedSymbols = effectiveSymbols;
        }
        if (catalog) {
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
            unresolvedSymbols,
            ids,
            params.properties,
            channel,
          );
        const upstreamLatencyMs = symbolLookupUpstreamMs + priceUpstreamMs;

        const enriched = feeds.map((f) => addDisplayPrices(f));
        const responseText = JSON.stringify({
          prices: enriched,
          ...(unresolvedSymbols ? {} : missingFeedsField(ids, feeds)),
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
        const rejectionType = rejectionErrorFor(err, "")?.errorType;

        logToolCall(logger, {
          ...baseMetrics,
          errorType: authError?.errorType ?? rejectionType ?? "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });

        if (authError) return toolError(authError.message);

        if (
          unresolvedSymbols &&
          err instanceof HttpError &&
          err.status === 400
        ) {
          return toolError(
            `The feed catalog is unavailable, so symbols could not be resolved, and Pyth Pro rejected ${unresolvedSymbols.join(", ")}. Pass full symbols from get_symbols (e.g. Crypto.BTC/USD) or price_feed_ids.`,
          );
        }

        const rejection = rejectionErrorFor(
          err,
          "Check the feed IDs, their state and min_channel with get_symbols.",
        );
        if (rejection) return toolError(rejection.message);

        logger.warn({ err }, "get_latest_price upstream error");
        return toolError("Failed to fetch latest price. Please try again.");
      }
    },
  );
}
