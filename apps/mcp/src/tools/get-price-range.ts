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
import { resolvedSymbolsField } from "../utils/resolve-symbols.js";
import { normalizeTimestampToMicroseconds } from "../utils/timestamp.js";
import {
  ACCESS_TOKEN_PARAM,
  AUTO_TIMESTAMP,
  CHANNEL_PARAM,
  DISPLAY_FIELDS,
  FEED_IDS_PARAM,
  HISTORY_START,
  IDS_WIN,
  PRICE_TOOL_CHOICE,
  SYMBOL_INPUTS,
  SYMBOLS_PARAM,
  TOKEN_REQUIRED,
} from "./descriptions.js";
import { resolveFeedInputs, runPriceTool } from "./price-tool.js";

/** The History API rejects windows longer than this. */
const MAX_WINDOW_US = 60_000_000;
const DEFAULT_LIMIT = 100;
// The API allows 1000 per page; a smaller cap keeps responses LLM-sized.
const MAX_LIMIT = 500;

const GetPriceRangeInput = {
  access_token: accessTokenSchema(ACCESS_TOKEN_PARAM),
  after: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Paging cursor: pass `next_cursor` from the previous response, with the same feeds, window and channel",
    ),
  channel: z.enum(CHANNELS).optional().describe(CHANNEL_PARAM),
  end: z.coerce
    .number()
    .positive()
    .describe(
      `Window end, inclusive. ${AUTO_TIMESTAMP}. At most 60 seconds after \`start\`; equal to \`start\` for one instant.`,
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
    .describe(`${FEED_IDS_PARAM}. Max 50.`),
  start: z.coerce
    .number()
    .positive()
    .describe(`Window start, inclusive. ${AUTO_TIMESTAMP}.`),
  symbols: z
    .array(z.string())
    .max(50)
    .optional()
    .describe(`${SYMBOLS_PARAM}. Max 50.`),
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
      description: [
        "Get every price update for one or more feeds within a short historical window (at most 60 seconds), e.g. to see exactly how a price moved around an event.",
        TOKEN_REQUIRED,
        SYMBOL_INPUTS,
        IDS_WIN,
        "Rows are ordered by time and interleaved across feeds; a fixed_rate@200ms channel yields 5 rows per feed per second. When `has_more` is true, call again with `after` set to `next_cursor` and the same feeds, window and channel.",
        HISTORY_START,
        DISPLAY_FIELDS,
        PRICE_TOOL_CHOICE,
      ].join(" "),
      inputSchema: GetPriceRangeInput,
      title: "Get Price Range",
    },
    (params, extra) =>
      runPriceTool(
        {
          failureMessage: "Failed to fetch the price range. Please try again.",
          logger,
          rejectionHint:
            "Check the feed IDs with get_symbols, the channel, and the paging cursor.",
          sessionContext,
          tool: "get_price_range",
        },
        params.access_token,
        extra,
        async (ctx) => {
          if (
            !(params.price_feed_ids?.length ?? 0) &&
            !(params.symbols?.length ?? 0)
          ) {
            return ctx.fail(
              "validation",
              "At least one of 'price_feed_ids' or 'symbols' is required",
            );
          }

          // Checked before any upstream call, including the catalog.
          const startUs = normalizeTimestampToMicroseconds(params.start);
          const endUs = normalizeTimestampToMicroseconds(params.end);
          // Both ends are inclusive, so start == end asks for one instant.
          if (endUs < startUs) {
            return ctx.fail("validation", "'end' must not be before 'start'");
          }
          if (endUs - startUs > MAX_WINDOW_US) {
            return ctx.fail(
              "validation",
              `The window is ${((endUs - startUs) / 1_000_000).toFixed(1)} seconds; get_price_range allows at most 60. Narrow it, or use get_candlestick_data for longer periods.`,
            );
          }

          // The range endpoint needs IDs, so the catalog is required for
          // symbol input.
          const inputs = await resolveFeedInputs({
            catalog: "required",
            historyClient,
            logger,
            priceFeedIds: params.price_feed_ids,
            symbols: params.symbols,
            token: ctx.token,
          });
          if (!inputs.ok) return ctx.fail(inputs.errorType, inputs.message);
          ctx.setFeedsRequested(inputs.ids.length);

          const channel = resolveChannel(params.channel, config);
          const range = await historyClient.getPriceRange(
            channel,
            inputs.ids,
            startUs,
            endUs,
            { after: params.after, limit: params.limit, token: ctx.token },
          );

          const prices = range.data.data.map((p) => addDisplayPrices(p));
          const nextCursor = range.data.next ?? null;
          return ctx.succeed(
            {
              channel,
              count: prices.length,
              has_more: nextCursor !== null,
              next_cursor: nextCursor,
              prices,
              ...resolvedSymbolsField(inputs.resolvedSymbols),
              window: {
                end_iso: new Date(endUs / 1000).toISOString(),
                end_us: endUs,
                start_iso: new Date(startUs / 1000).toISOString(),
                start_us: startUs,
              },
            },
            {
              numFeedsReturned: prices.length,
              upstreamLatencyMs:
                inputs.upstreamLatencyMs + range.upstreamLatencyMs,
            },
          );
        },
      ),
  );
}
