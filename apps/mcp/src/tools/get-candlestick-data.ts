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
import {
  ACCESS_TOKEN_PARAM,
  CHANNEL_PARAM,
  HISTORY_START,
  PRICE_TOOL_CHOICE,
  SYMBOL_INPUTS,
  TIMESTAMP_REFERENCE,
  TOKEN_REQUIRED,
} from "./descriptions.js";
import { resolveFeedInputs, runPriceTool } from "./price-tool.js";

const MAX_CANDLES = 500;

const GetCandlestickDataInput = {
  access_token: accessTokenSchema(ACCESS_TOKEN_PARAM),
  channel: z.enum(CHANNELS).optional().describe(CHANNEL_PARAM),
  from: z.coerce
    .number()
    .int()
    .positive()
    .describe("Start time, Unix seconds only (not milliseconds)"),
  resolution: z
    .enum(RESOLUTIONS)
    .describe(
      "Candle size: 1, 5, 15, 30, 60 (minutes), 120, 240, 360, 720 (hours), D (daily), W (weekly), M (monthly)",
    ),
  symbol: z
    .string()
    .min(1)
    .describe(
      "One symbol from get_symbols (e.g. 'Crypto.BTC/USD', 'Equity.US.AAPL/USD') or a bare pair like 'BTC/USD'",
    ),
  to: z.coerce
    .number()
    .int()
    .positive()
    .describe("End time, Unix seconds only (not milliseconds)"),
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
        [
          "Fetch OHLC candlestick bars for one symbol, for charting, technical analysis or backtesting. OHLC values are already human-readable (no exponent).",
          TOKEN_REQUIRED,
          SYMBOL_INPUTS,
          "`from` and `to` are Unix seconds only. Resolutions: 1/5/15/30/60 minutes, 120/240/360/720 (multi-hour), D (daily), W (weekly), M (monthly). At most 500 candles are returned; `truncated: true` means narrow the range or use a larger resolution.",
          HISTORY_START,
          PRICE_TOOL_CHOICE,
        ].join(" ") + `\n\n${TIMESTAMP_REFERENCE}`,
      inputSchema: GetCandlestickDataInput,
      title: "Get Candlestick Data",
    },
    (params, extra) =>
      runPriceTool(
        {
          failureMessage: "Failed to fetch candlestick data. Please try again.",
          logger,
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

          // History needs the full symbol; without the catalog, use it as given.
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

          // OHLC values are already in display units.
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
