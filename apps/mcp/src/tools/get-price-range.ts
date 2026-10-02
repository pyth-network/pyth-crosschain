import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import { HttpError } from "../clients/retry.js";
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
import {
  resolvedSymbolsField,
  resolveSymbols,
} from "../utils/resolve-symbols.js";
import {
  getServerTime,
  normalizeTimestampToMicroseconds,
} from "../utils/timestamp.js";

/** The History API rejects windows longer than this. */
const MAX_WINDOW_US = 60_000_000;
const DEFAULT_LIMIT = 100;
// The API allows 1000 per page; a smaller cap keeps responses LLM-sized.
const MAX_LIMIT = 500;

const GetPriceRangeInput = {
  access_token: z
    .string()
    .trim()
    .min(1, "access_token must not be empty")
    .optional()
    .describe(
      "Your Pyth Pro access token. Optional when the server was started with PYTH_PRO_ACCESS_TOKEN (local stdio setups); required otherwise. Get one at https://docs.pyth.network/price-feeds/pro/acquire-access-token",
    ),
  after: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Paging cursor: pass `next_cursor` from the previous response, with the same feeds, window and channel",
    ),
  channel: z
    .enum(CHANNELS)
    .optional()
    .describe(
      `Override the default channel (update rate): ${CHANNELS.join(", ")}`,
    ),
  end: z.coerce
    .number()
    .positive()
    .describe(
      "Window end (inclusive). Unix seconds, milliseconds or microseconds (auto-detected). At most 60 seconds after `start`.",
    ),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe(
      `Rows per page (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}). Each row is one update for one feed.`,
    ),
  price_feed_ids: z
    .array(z.coerce.number().int().positive())
    .max(50)
    .optional()
    .describe("Numeric feed IDs from get_symbols"),
  start: z.coerce
    .number()
    .positive()
    .describe(
      "Window start (inclusive). Unix seconds, milliseconds or microseconds (auto-detected).",
    ),
  symbols: z
    .array(z.string())
    .max(50)
    .optional()
    .describe(
      "Symbols from get_symbols (e.g. ['Crypto.BTC/USD']) or bare pairs like 'BTC/USD'",
    ),
};

export function registerGetPriceRange(
  server: McpServer,
  config: Config,
  historyClient: HistoryClient,
  logger: Logger,
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "get_price_range",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "Get every price update for one or more feeds within a short historical window (at most 60 seconds), e.g. to see exactly how a price moved around an event. Requires a Pyth Pro access token: pass `access_token`, unless the server was started with PYTH_PRO_ACCESS_TOKEN. For a single point in time use get_historical_price; for longer periods use get_candlestick_data. Rows are ordered by time; a fixed_rate@200ms channel yields 5 rows per feed per second. When `has_more` is true, call again with `after` set to `next_cursor`. Prices are integers with an exponent; display_* fields apply it for you.",
      inputSchema: GetPriceRangeInput,
      title: "Get Price Range",
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();
      const token = resolveAccessToken(params.access_token, config);

      // When both are provided, prefer price_feed_ids and ignore symbols.
      const effectiveSymbols =
        (params.price_feed_ids?.length ?? 0) > 0 ? undefined : params.symbols;

      const baseMetrics = {
        apiKeyLast4: getApiKeyLast4(token),
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        numFeedsRequested: 0,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: computeTokenHash(token),
        tool: "get_price_range" as const,
      };

      const validationError = (message: string) => {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(message);
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

      if (
        !(params.price_feed_ids?.length ?? 0) &&
        !(effectiveSymbols?.length ?? 0)
      ) {
        return validationError(
          "At least one of 'price_feed_ids' or 'symbols' is required",
        );
      }

      const startUs = normalizeTimestampToMicroseconds(params.start);
      const endUs = normalizeTimestampToMicroseconds(params.end);
      if (endUs <= startUs) {
        return validationError("'end' must be after 'start'");
      }
      if (endUs - startUs > MAX_WINDOW_US) {
        return validationError(
          `The window is ${((endUs - startUs) / 1_000_000).toFixed(1)} seconds; get_price_range allows at most 60. Narrow it, or use get_candlestick_data for longer periods.`,
        );
      }

      const channel = resolveChannel(params.channel, config);

      try {
        let ids = params.price_feed_ids ? [...params.price_feed_ids] : [];
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
          ids = resolution.feeds.map((f) => f.pyth_lazer_id);
        }
        ids = [...new Set(ids)];
        baseMetrics.numFeedsRequested = ids.length;

        const { data: page, upstreamLatencyMs: rangeUpstreamMs } =
          await historyClient.getPriceRange(channel, ids, startUs, endUs, {
            after: params.after,
            limit: params.limit,
            token,
          });

        const prices = page.data.map((p) => addDisplayPrices(p));
        const nextCursor = page.next ?? null;
        const responseText = JSON.stringify({
          channel,
          count: prices.length,
          has_more: nextCursor !== null,
          next_cursor: nextCursor,
          prices,
          ...resolvedSymbolsField(resolvedSymbols),
          window: {
            end_iso: new Date(endUs / 1000).toISOString(),
            end_us: endUs,
            start_iso: new Date(startUs / 1000).toISOString(),
            start_us: startUs,
          },
          ...getServerTime(),
        });

        logToolCall(logger, {
          ...baseMetrics,
          latencyMs: Date.now() - start,
          numFeedsReturned: prices.length,
          responseSizeBytes: Buffer.byteLength(responseText),
          status: "success",
          upstreamLatencyMs: symbolLookupUpstreamMs + rangeUpstreamMs,
        });
        return {
          content: [{ text: responseText, type: "text" as const }],
        };
      } catch (err) {
        const authError = authErrorFor(err);
        if (authError) {
          logToolCall(logger, {
            ...baseMetrics,
            errorType: authError.errorType,
            latencyMs: Date.now() - start,
            status: "error",
          });
          return toolError(authError.message);
        }

        if (
          err instanceof HttpError &&
          (err.status === 400 || err.status === 404)
        ) {
          logToolCall(logger, {
            ...baseMetrics,
            errorType: err.status === 404 ? "not_found" : "validation",
            latencyMs: Date.now() - start,
            status: "error",
          });
          return toolError(
            `Pyth Pro rejected the request (${err.status})${err.detail ? `: ${err.detail}` : ""}. Check the feed IDs with get_symbols, the channel, and the paging cursor.`,
          );
        }

        logger.warn({ err }, "get_price_range upstream error");
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError("Failed to fetch the price range. Please try again.");
      }
    },
  );
}
