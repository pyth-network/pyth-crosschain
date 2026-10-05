import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { HistoryClient } from "../clients/history.js";
import type { Config } from "../config.js";
import { CHANNELS } from "../constants.js";
import type { SessionContext } from "../server.js";
import { accessTokenSchema } from "../utils/access-token.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import { missingFeedsField } from "../utils/missing-feeds.js";
import { resolvedSymbolsField } from "../utils/resolve-symbols.js";
import {
  alignTimestampToChannel,
  DATA_AVAILABLE_FROM_ISO,
  DATA_AVAILABLE_FROM_UNIX,
  normalizeTimestampToMicroseconds,
  unixSecondsToISO,
} from "../utils/timestamp.js";
import { resolveFeedInputs, runPriceTool } from "./price-tool.js";

const GetHistoricalPriceInput = {
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
    .max(50)
    .optional()
    .describe("Numeric feed IDs from get_symbols"),
  symbols: z
    .array(z.string())
    .max(50)
    .optional()
    .describe(
      "Symbols from get_symbols (e.g. ['Crypto.BTC/USD', 'Equity.US.AAPL/USD']) or bare pairs like 'BTC/USD'",
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
        "Get price data for specific feeds at a historical timestamp. Requires the user's own Pyth Pro access token as `access_token`. Use get_symbols first to find feed IDs or symbols. If both price_feed_ids and symbols are provided, only price_feed_ids are used. Accepts Unix seconds, milliseconds, or microseconds (auto-detected). Historical data is available from April 2025 onward — do not request timestamps before that. The timestamp is internally converted to microseconds and aligned (rounded down) to the channel rate — e.g. for fixed_rate@200ms, it must be divisible by 200,000μs. Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_* fields (display_price, display_bid, display_ask, display_confidence, display_ema_price, display_ema_confidence, display_funding_rate) apply the exponent for you.\n\nTimestamp reference:\n  2025-04-01 (earliest available) = 1743465600\n  2026-01-01 = 1767225600\n  2026-06-01 = 1780272000\nAlways double-check your timestamp math — year-boundary errors are common.",
      inputSchema: GetHistoricalPriceInput,
      title: "Get Historical Price",
    },
    (params, extra) => {
      // Named in Pyth's rejection message; set to the resolved IDs below.
      let requestedIds = params.price_feed_ids ?? [];
      return runPriceTool(
        {
          failureMessage: "Failed to fetch historical price. Please try again.",
          logger,
          rejectionHint: () =>
            `Requested feeds (IDs: ${formatIds(requestedIds)}) at ${requestedTimeLabel(params.timestamp)}. Check the feed IDs, their state and min_channel with get_symbols.`,
          sessionContext,
          tool: "get_historical_price",
        },
        params.access_token,
        extra,
        async (ctx) => {
          // Look up with the caller's token: some feeds only appear in the
          // catalog for authenticated callers. The price endpoint needs IDs,
          // so the catalog is required for symbol input.
          const inputs = await resolveFeedInputs({
            catalog: "required",
            historyClient,
            logger,
            priceFeedIds: params.price_feed_ids,
            symbols: params.symbols,
            token: ctx.token,
          });
          if (!inputs.ok) return ctx.fail(inputs.errorType, inputs.message);
          const { ids, resolvedSymbols } = inputs;
          requestedIds = ids;
          ctx.setFeedsRequested(ids.length);

          const channel = resolveChannel(params.channel, config);
          const normalizedUs = normalizeTimestampToMicroseconds(
            params.timestamp,
          );
          const history = await historyClient.getHistoricalPrice(
            channel,
            ids,
            alignTimestampToChannel(normalizedUs, channel),
            ctx.token,
          );

          const upstreamLatencyMs =
            inputs.upstreamLatencyMs + history.upstreamLatencyMs;
          const prices = history.data.map((p) => addDisplayPrices(p));
          if (prices.length === 0) {
            return ctx.succeed(
              {
                ...noDataPayload(normalizedUs),
                ...resolvedSymbolsField(resolvedSymbols),
              },
              { numFeedsReturned: 0, upstreamLatencyMs },
            );
          }
          return ctx.succeed(
            {
              prices,
              ...missingFeedsField(ids, history.data),
              ...resolvedSymbolsField(resolvedSymbols),
            },
            { numFeedsReturned: prices.length, upstreamLatencyMs },
          );
        },
      );
    },
  );
}

function formatIds(ids: readonly number[]): string {
  const shown = ids.slice(0, 5).join(", ");
  return ids.length > 5 ? `${shown} and ${ids.length - 5} more` : shown;
}

function requestedTimeLabel(timestamp: number): string {
  const seconds = Math.floor(
    normalizeTimestampToMicroseconds(timestamp) / 1_000_000,
  );
  return `${unixSecondsToISO(seconds)} (unix: ${seconds})`;
}

/** Empty result: say whether the time is too early, in the future, or just has no data. */
function noDataPayload(normalizedUs: number): Record<string, unknown> {
  const requestedSeconds = Math.floor(normalizedUs / 1_000_000);
  const requestedISO = unixSecondsToISO(requestedSeconds);
  const nowSeconds = Math.floor(Date.now() / 1000);

  let direction: "too_late" | "too_early" | "in_range_no_data";
  if (normalizedUs > Date.now() * 1000) direction = "too_late";
  else if (requestedSeconds < DATA_AVAILABLE_FROM_UNIX) direction = "too_early";
  else direction = "in_range_no_data";

  const hintByDirection = {
    in_range_no_data: `No price data found at ${requestedISO} for these feeds. The timestamp is within the valid range but these specific feeds may not have data at this time. Try a slightly different timestamp or verify the feed IDs.`,
    too_early: `Requested date ${requestedISO} is before the valid range (${DATA_AVAILABLE_FROM_ISO} to ${unixSecondsToISO(nowSeconds)}). Try a timestamp after ${DATA_AVAILABLE_FROM_ISO}.`,
    too_late: `Requested date ${requestedISO} is in the future. Latest available: ${unixSecondsToISO(nowSeconds)}.`,
  };

  return {
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
  };
}
