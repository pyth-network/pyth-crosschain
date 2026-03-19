import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { RESOLUTIONS } from "../constants.js";
import type { SessionContext } from "../server.js";
import { resolveChannel } from "../utils/channel.js";
import { toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";
import {
  DATA_AVAILABLE_FROM_ISO,
  DATA_AVAILABLE_FROM_UNIX,
  getServerTime,
  unixSecondsToISO,
} from "../utils/timestamp.js";

const MAX_CANDLES = 500;

const GetCandlestickDataInput = {
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
  from: z.coerce
    .number()
    .int()
    .positive()
    .describe("Start time (Unix seconds)"),
  resolution: z
    .enum(RESOLUTIONS)
    .describe(
      "Candle size: 1, 5, 15, 30, 60 (minutes), 120, 240, 360, 720 (hours), D (daily), W (weekly), M (monthly)",
    ),
  symbol: z
    .string()
    .min(1)
    .describe(
      "Full symbol from get_symbols including asset type prefix (e.g. 'Crypto.BTC/USD', not 'BTC/USD')",
    ),
  to: z.coerce.number().int().positive().describe("End time (Unix seconds)"),
};

export function registerGetCandlestickData(
  server: McpServer,
  config: Config,
  historyClient: HistoryClient,
  logger: Logger,
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "get_candlestick_data",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        readOnlyHint: true,
      },
      description:
        "Fetch OHLC candlestick data for a symbol. Use for charting, technical analysis, backtesting. IMPORTANT: The symbol must be the full name from get_symbols including the asset type prefix (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL', 'FX.EUR/USD') — never use bare names like 'BTC/USD'. Historical data is available from April 2025 onward — do not request timestamps before that. Resolutions: 1/5/15/30/60 minutes, 120/240/360/720 (multi-hour), D (daily), W (weekly), M (monthly). Timestamps are Unix seconds.\n\nTimestamp reference (Unix seconds):\n  2025-04-01 (earliest available) = 1743465600\n  2026-01-01 = 1767225600\n  2026-06-01 = 1780272000\nAlways double-check your timestamp math — year-boundary errors are common.",
      inputSchema: GetCandlestickDataInput,
      title: "Get Candlestick Data",
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
        tool: "get_candlestick_data" as const,
      };

      if (params.from >= params.to) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError("'from' must be before 'to'");
      }

      const channel = resolveChannel(params.channel, config);

      try {
        const { data, upstreamLatencyMs } =
          await historyClient.getCandlestickData(
            channel,
            params.symbol,
            params.resolution,
            params.from,
            params.to,
          );

        if (data.s === "no_data") {
          const fromISO = unixSecondsToISO(params.from);
          const toISO = unixSecondsToISO(params.to);
          const nowSeconds = Math.floor(Date.now() / 1000);
          logToolCall(logger, {
            ...baseMetrics,
            errorType: "no_data",
            latencyMs: Date.now() - start,
            status: "error",
            upstreamLatencyMs,
          });
          return toolError(
            `No candlestick data for ${params.symbol} from ${fromISO} to ${toISO}. ` +
              `Data available from ${DATA_AVAILABLE_FROM_ISO} to ${unixSecondsToISO(nowSeconds)}. ` +
              (params.from < DATA_AVAILABLE_FROM_UNIX
                ? `Your 'from' (${fromISO}) is before data availability. Try from=${DATA_AVAILABLE_FROM_UNIX} (${DATA_AVAILABLE_FROM_ISO}).`
                : `Try a different time range or symbol.`),
          );
        }

        if (data.s === "error") {
          logToolCall(logger, {
            ...baseMetrics,
            errorType: "upstream",
            latencyMs: Date.now() - start,
            status: "error",
            upstreamLatencyMs,
          });
          return toolError(
            data.errmsg ?? "Unknown error from Pyth History API",
          );
        }

        const totalCandles = data.t.length;

        if (totalCandles === 0) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const responseText = JSON.stringify({
            candles: 0,
            hint: `No candlestick data for this symbol/time range. Data available from ${DATA_AVAILABLE_FROM_ISO} onward.`,
            requested_from_iso: unixSecondsToISO(params.from),
            requested_to_iso: unixSecondsToISO(params.to),
            s: "ok",
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
            upstreamLatencyMs,
          });
          return {
            content: [{ text: responseText, type: "text" as const }],
          };
        }

        const truncated = totalCandles > MAX_CANDLES;

        // Note: The upstream History API (TradingView-format) returns OHLC values
        // in human-readable (display) format, not raw integers with exponents.
        // No addDisplayPrices() transformation is needed here, unlike get_latest_price
        // and get_historical_price which return raw integer prices.
        const result = truncated
          ? {
              c: data.c.slice(0, MAX_CANDLES),
              h: data.h.slice(0, MAX_CANDLES),
              l: data.l.slice(0, MAX_CANDLES),
              o: data.o.slice(0, MAX_CANDLES),
              s: data.s,
              t: data.t.slice(0, MAX_CANDLES),
              v: data.v.slice(0, MAX_CANDLES),
            }
          : data;

        const response = truncated
          ? {
              ...result,
              hint: "Narrow your time range or use a larger resolution to get all candles.",
              returned: MAX_CANDLES,
              total_available: totalCandles,
              truncated: true,
              ...getServerTime(),
            }
          : { ...result, ...getServerTime() };

        const responseText = JSON.stringify(response);
        logToolCall(logger, {
          ...baseMetrics,
          latencyMs: Date.now() - start,
          numFeedsReturned: truncated ? MAX_CANDLES : totalCandles,
          responseSizeBytes: Buffer.byteLength(responseText),
          status: "success",
          upstreamLatencyMs,
        });
        return {
          content: [{ text: responseText, type: "text" as const }],
        };
      } catch (err) {
        logger.warn({ err }, "get_candlestick_data upstream error");
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "upstream",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError("Failed to fetch candlestick data. Please try again.");
      }
    },
  );
}
