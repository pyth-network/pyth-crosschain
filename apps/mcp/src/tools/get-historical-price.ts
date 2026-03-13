import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import { HttpError } from "../clients/retry.js";
import type { Config } from "../config.js";
import type { SessionContext } from "../server.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import { ErrorMessages, toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";
import {
  DATA_AVAILABLE_FROM_ISO,
  DATA_AVAILABLE_FROM_UNIX,
  alignTimestampToChannel,
  getServerTime,
  normalizeTimestampToMicroseconds,
  unixSecondsToISO,
} from "../utils/timestamp.js";

const GetHistoricalPriceInput = {
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
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "get_historical_price",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "Get price data for specific feeds at a historical timestamp. Use get_symbols first to find feed IDs or symbols. If both price_feed_ids and symbols are provided, only price_feed_ids are used. Accepts Unix seconds, milliseconds, or microseconds (auto-detected). Historical data is available from April 2025 onward — do not request timestamps before that. The timestamp is internally converted to microseconds and aligned (rounded down) to the channel rate — e.g. for fixed_rate@200ms, it must be divisible by 200,000μs. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_price fields are included for convenience.\n\nTimestamp reference:\n  2025-04-01 (earliest available) = 1743465600\n  2026-01-01 = 1767225600\n  2026-06-01 = 1780272000\nAlways double-check your timestamp math — year-boundary errors are common.",
      inputSchema: GetHistoricalPriceInput,
      title: "Get Historical Price",
    },
    async (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();

      // When both are provided, prefer price_feed_ids and ignore symbols.
      const effectiveSymbols =
        (params.price_feed_ids?.length ?? 0) > 0 ? undefined : params.symbols;

      const baseMetrics = {
        apiKeyLast4: null as null,
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        numFeedsRequested: 0,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: null as null,
        tool: "get_historical_price" as const,
      };

      if (
        !(params.price_feed_ids?.length ?? 0) &&
        !(effectiveSymbols?.length ?? 0)
      ) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(
          "At least one of 'price_feed_ids' or 'symbols' is required",
        );
      }

      const channel = resolveChannel(params.channel, config);

      let ids: number[] = [];
      let priceEndpointCalled = false;

      try {
        // Resolve symbols to IDs
        ids = params.price_feed_ids ? [...params.price_feed_ids] : [];
        let symbolLookupUpstreamMs = 0;
        if ((effectiveSymbols?.length ?? 0) > 0) {
          const { data: allFeeds, upstreamLatencyMs } =
            await historyClient.getSymbols();
          symbolLookupUpstreamMs = upstreamLatencyMs;
          for (const symbol of effectiveSymbols ?? []) {
            const feed = allFeeds.find((f) => f.symbol === symbol);
            if (!feed) {
              logToolCall(logger, {
                ...baseMetrics,
                errorType: "not_found",
                latencyMs: Date.now() - start,
                status: "error",
              });
              return toolError(ErrorMessages.FEED_NOT_FOUND(symbol));
            }
            ids.push(feed.pyth_lazer_id);
          }
        }

        // Deduplicate
        ids = [...new Set(ids)];
        baseMetrics.numFeedsRequested = ids.length;

        // Check for future timestamps before channel alignment
        const normalizedUs = normalizeTimestampToMicroseconds(params.timestamp);
        const nowUs = Date.now() * 1000;

        const timestampUs = alignTimestampToChannel(normalizedUs, channel);

        priceEndpointCalled = true;
        const { data: prices, upstreamLatencyMs: priceUpstreamMs } =
          await historyClient.getHistoricalPrice(channel, ids, timestampUs);

        const totalUpstreamMs = symbolLookupUpstreamMs + priceUpstreamMs;
        const enriched = prices.map((p) => addDisplayPrices(p));

        if (enriched.length === 0) {
          const requestedSeconds = Math.floor(normalizedUs / 1_000_000);
          const requestedISO = unixSecondsToISO(requestedSeconds);
          const nowSeconds = Math.floor(Date.now() / 1000);

          const direction =
            normalizedUs > nowUs
              ? ("too_late" as const)
              : requestedSeconds < DATA_AVAILABLE_FROM_UNIX
                ? ("too_early" as const)
                : ("in_range_no_data" as const);

          const hintByDirection = {
            in_range_no_data: `No price data found at ${requestedISO} for these feeds. The timestamp is within the valid range but these specific feeds may not have data at this time. Try a slightly different timestamp or verify the feed IDs.`,
            too_early: `Requested date ${requestedISO} is before the valid range (${DATA_AVAILABLE_FROM_ISO} to ${unixSecondsToISO(nowSeconds)}). Try a timestamp after ${DATA_AVAILABLE_FROM_ISO}.`,
            too_late: `Requested date ${requestedISO} is in the future. Latest available: ${unixSecondsToISO(nowSeconds)}.`,
          };

          const responseText = JSON.stringify({
            direction,
            hint: hintByDirection[direction],
            prices: [],
            requested_timestamp_iso: requestedISO,
            requested_timestamp_unix: requestedSeconds,
            valid_range: {
              from_iso: DATA_AVAILABLE_FROM_ISO,
              from_unix: DATA_AVAILABLE_FROM_UNIX,
              to_iso: unixSecondsToISO(nowSeconds),
              to_unix: nowSeconds,
            },
            ...getServerTime(),
          });
          logToolCall(logger, {
            ...baseMetrics,
            latencyMs: Date.now() - start,
            numFeedsReturned: 0,
            responseSizeBytes: Buffer.byteLength(responseText),
            status: "success",
            upstreamLatencyMs: totalUpstreamMs,
          });
          return {
            content: [{ text: responseText, type: "text" as const }],
          };
        }

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
          upstreamLatencyMs: totalUpstreamMs,
        });

        return {
          content: [{ text: responseText, type: "text" as const }],
        };
      } catch (err) {
        if (
          priceEndpointCalled &&
          err instanceof HttpError &&
          (err.status === 400 || err.status === 404)
        ) {
          const idSnippet = ids.slice(0, 5).join(", ");
          const suffix = ids.length > 5 ? ` and ${ids.length - 5} more` : "";
          const requestedSeconds = Math.floor(
            normalizeTimestampToMicroseconds(params.timestamp) / 1_000_000,
          );
          logToolCall(logger, {
            ...baseMetrics,
            errorType: "not_found",
            latencyMs: Date.now() - start,
            status: "error",
          });
          return toolError(
            `No data found for feeds (IDs: ${idSnippet}${suffix}) at ${unixSecondsToISO(requestedSeconds)} (unix: ${requestedSeconds}). Verify feed IDs with get_symbols.`,
          );
        }

        logger.warn({ err }, "get_historical_price upstream error");
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError("Failed to fetch historical price. Please try again.");
      }
    },
  );
}
