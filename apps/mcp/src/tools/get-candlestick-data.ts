import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { CHANNELS, RESOLUTIONS } from "../constants.js";
import type { SessionContext } from "../server.js";
import { accessTokenSchema } from "../utils/access-token.js";
import { resolveChannel } from "../utils/channel.js";
import { resolvedSymbolsField } from "../utils/resolve-symbols.js";
import {
  DATA_AVAILABLE_FROM_ISO,
  DATA_AVAILABLE_FROM_UNIX,
  unixSecondsToISO,
} from "../utils/timestamp.js";
import { resolveFeedInputs, runPriceTool } from "./price-tool.js";

const MAX_CANDLES = 500;

const GetCandlestickDataInput = {
  access_token: accessTokenSchema(
    "Your Pyth Pro access token. Get one at https://docs.pyth.network/price-feeds/pro/acquire-access-token",
  ),
  channel: z
    .enum(CHANNELS)
    .optional()
    .describe(
      `Override the default channel (update rate): ${CHANNELS.join(", ")}`,
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
      "Symbol from get_symbols (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL/USD') or a bare pair like 'BTC/USD'",
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
        "Fetch OHLC candlestick data for a symbol. Requires the user's own Pyth Pro access token as `access_token`. Use for charting, technical analysis, backtesting. The symbol can be a full name from get_symbols (e.g. 'Crypto.BTC/USD', 'FX.EUR/USD') or a bare pair like 'BTC/USD', which resolves to the live spot feed when there is one, otherwise to the only remaining match (`resolved_symbols` in the response shows the result; ambiguous inputs return the candidates). Historical data is available from April 2025 onward — do not request timestamps before that. Resolutions: 1/5/15/30/60 minutes, 120/240/360/720 (multi-hour), D (daily), W (weekly), M (monthly). Timestamps are Unix seconds.\n\nTimestamp reference (Unix seconds):\n  2025-04-01 (earliest available) = 1743465600\n  2026-01-01 = 1767225600\n  2026-06-01 = 1780272000\nAlways double-check your timestamp math — year-boundary errors are common.",
      inputSchema: GetCandlestickDataInput,
      title: "Get Candlestick Data",
    },
    (params, extra) =>
      runPriceTool(
        {
          failureMessage: "Failed to fetch candlestick data. Please try again.",
          logger,
          // e.g. 404 "symbol not found." when the channel is faster than the
          // feed's min_channel; retrying does not help.
          rejectionHint:
            "Check the symbol, its state and min_channel with get_symbols, and the resolution and time range.",
          sessionContext,
          tool: "get_candlestick_data",
        },
        params.access_token,
        extra,
        async (ctx) => {
          if (params.from >= params.to) {
            return ctx.fail("validation", "'from' must be before 'to'");
          }

          // Accept bare pairs like BTC/USD; the History API needs the full
          // symbol. If the catalog is unavailable, use the symbol as given.
          const inputs = await resolveFeedInputs({
            catalog: "optional",
            historyClient,
            logger,
            symbols: [params.symbol],
            token: ctx.token,
          });
          if (!inputs.ok) return ctx.fail(inputs.errorType, inputs.message);
          const symbol = inputs.feeds[0]?.symbol ?? params.symbol;
          const resolvedSymbols = resolvedSymbolsField(inputs.resolvedSymbols);
          ctx.setFeedsRequested(1);

          const history = await historyClient.getCandlestickData(
            resolveChannel(params.channel, config),
            symbol,
            params.resolution,
            params.from,
            params.to,
            ctx.token,
          );
          const data = history.data;
          const upstreamLatencyMs =
            inputs.upstreamLatencyMs + history.upstreamLatencyMs;

          if (data.s === "no_data") {
            const fromISO = unixSecondsToISO(params.from);
            const toISO = unixSecondsToISO(params.to);
            const nowSeconds = Math.floor(Date.now() / 1000);
            return ctx.fail(
              "no_data",
              `No candlestick data for ${symbol} from ${fromISO} to ${toISO}. ` +
                `Data available from ${DATA_AVAILABLE_FROM_ISO} to ${unixSecondsToISO(nowSeconds)}. ` +
                (params.from < DATA_AVAILABLE_FROM_UNIX
                  ? `Your 'from' (${fromISO}) is before data availability. Try from=${DATA_AVAILABLE_FROM_UNIX} (${DATA_AVAILABLE_FROM_ISO}).`
                  : `Try a different time range or symbol.`),
              upstreamLatencyMs,
            );
          }

          if (data.s === "error") {
            return ctx.fail(
              "upstream",
              data.errmsg ?? "Unknown error from Pyth History API",
              upstreamLatencyMs,
            );
          }

          const totalCandles = data.t.length;
          if (totalCandles === 0) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            return ctx.succeed(
              {
                candles: 0,
                hint: `No candlestick data for this symbol/time range. Data available from ${DATA_AVAILABLE_FROM_ISO} onward.`,
                requested_from_iso: unixSecondsToISO(params.from),
                requested_to_iso: unixSecondsToISO(params.to),
                ...resolvedSymbols,
                s: "ok",
                valid_range: {
                  from_iso: DATA_AVAILABLE_FROM_ISO,
                  from_unix: DATA_AVAILABLE_FROM_UNIX,
                  to_iso: unixSecondsToISO(nowSeconds),
                  to_unix: nowSeconds,
                },
              },
              { numFeedsReturned: 0, upstreamLatencyMs },
            );
          }

          // The History API (TradingView format) returns OHLC values already
          // in display units, so no addDisplayPrices() here.
          if (totalCandles <= MAX_CANDLES) {
            return ctx.succeed(
              { ...data, ...resolvedSymbols },
              { numFeedsReturned: totalCandles, upstreamLatencyMs },
            );
          }
          return ctx.succeed(
            {
              c: data.c.slice(0, MAX_CANDLES),
              h: data.h.slice(0, MAX_CANDLES),
              hint: "Narrow your time range or use a larger resolution to get all candles.",
              l: data.l.slice(0, MAX_CANDLES),
              o: data.o.slice(0, MAX_CANDLES),
              returned: MAX_CANDLES,
              s: data.s,
              t: data.t.slice(0, MAX_CANDLES),
              total_available: totalCandles,
              truncated: true,
              v: data.v.slice(0, MAX_CANDLES),
              ...resolvedSymbols,
            },
            { numFeedsReturned: MAX_CANDLES, upstreamLatencyMs },
          );
        },
      ),
  );
}
