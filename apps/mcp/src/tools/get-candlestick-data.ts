import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { RESOLUTIONS } from "../constants.js";
import { resolveChannel } from "../utils/channel.js";
import { ErrorMessages, toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";
import { channelParam } from "./schemas.js";

const MAX_CANDLES = 500;

const GetCandlestickDataInput = {
  channel: channelParam,
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
): void {
  server.registerTool(
    "get_candlestick_data",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description: `Fetch OHLC candlestick data for a symbol. Use for charting, technical analysis, backtesting. IMPORTANT: The symbol must be the full name from get_symbols including the asset type prefix (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL', 'FX.EUR/USD') — never use bare names like 'BTC/USD'. Historical data is available from April 2025 onward — do not request timestamps before that. For reference, the current server time is Unix ${Math.floor(Date.now() / 1000)} seconds. Resolutions: 1/5/15/30/60 minutes, 120/240/360/720 (multi-hour), D (daily), W (weekly), M (monthly). Timestamps are Unix seconds.`,
      inputSchema: GetCandlestickDataInput,
    },
    async (params) => {
      const start = Date.now();

      if (params.from >= params.to) {
        logToolCall(
          logger,
          "get_candlestick_data",
          "error",
          Date.now() - start,
          false,
          "validation",
        );
        return toolError("'from' must be before 'to'");
      }

      const channel = resolveChannel(params.channel, config);

      try {
        const data = await historyClient.getCandlestickData(
          channel,
          params.symbol,
          params.resolution,
          params.from,
          params.to,
        );

        if (data.s === "no_data") {
          logToolCall(
            logger,
            "get_candlestick_data",
            "error",
            Date.now() - start,
            false,
            "no_data",
          );
          return toolError(ErrorMessages.NO_DATA);
        }

        if (data.s === "error") {
          logToolCall(
            logger,
            "get_candlestick_data",
            "error",
            Date.now() - start,
            false,
            "upstream",
          );
          return toolError(
            data.errmsg ?? "Unknown error from Pyth History API",
          );
        }

        const totalCandles = data.t.length;

        if (totalCandles === 0) {
          logToolCall(
            logger,
            "get_candlestick_data",
            "success",
            Date.now() - start,
            false,
          );
          return {
            content: [
              {
                text: JSON.stringify({
                  candles: 0,
                  hint: "No candlestick data for this symbol/time range. Data is available from April 2025 onward. Try a more recent time range or a different resolution.",
                  s: "ok",
                }),
                type: "text" as const,
              },
            ],
          };
        }

        const truncated = totalCandles > MAX_CANDLES;

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
            }
          : result;

        logToolCall(
          logger,
          "get_candlestick_data",
          "success",
          Date.now() - start,
          false,
        );
        return {
          content: [{ text: JSON.stringify(response), type: "text" as const }],
        };
      } catch (err) {
        logger.warn({ err }, "get_candlestick_data upstream error");
        logToolCall(
          logger,
          "get_candlestick_data",
          "error",
          Date.now() - start,
          false,
          "upstream",
        );
        return toolError("Failed to fetch candlestick data. Please try again.");
      }
    },
  );
}
