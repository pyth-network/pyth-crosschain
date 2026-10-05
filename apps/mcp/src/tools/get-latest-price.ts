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
import { missingFeedsField } from "../utils/missing-feeds.js";
import { resolvedSymbolsField } from "../utils/resolve-symbols.js";
import {
  ACCESS_TOKEN_PARAM,
  CHANNEL_PARAM,
  DISPLAY_FIELDS,
  FEED_IDS_PARAM,
  IDS_WIN,
  MISSING_FEEDS,
  PRICE_TOOL_CHOICE,
  SYMBOL_INPUTS,
  SYMBOLS_PARAM,
  TOKEN_REQUIRED,
} from "./descriptions.js";
import { resolveFeedInputs, runPriceTool } from "./price-tool.js";

const GetLatestPriceInput = {
  access_token: accessTokenSchema(ACCESS_TOKEN_PARAM),
  channel: z.enum(CHANNELS).optional().describe(CHANNEL_PARAM),
  price_feed_ids: z
    .array(z.coerce.number().int().positive())
    .max(100)
    .optional()
    .describe(`${FEED_IDS_PARAM}. Max 100.`),
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
    .describe(`${SYMBOLS_PARAM}. Max 100.`),
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
      description: [
        "Get the most recent real-time price for one or more feeds.",
        TOKEN_REQUIRED,
        SYMBOL_INPUTS,
        IDS_WIN,
        MISSING_FEEDS,
        DISPLAY_FIELDS,
        PRICE_TOOL_CHOICE,
      ].join(" "),
      inputSchema: GetLatestPriceInput,
      title: "Get Latest Price",
    },
    (params, extra) =>
      runPriceTool(
        {
          failureMessage: "Failed to fetch latest price. Please try again.",
          logger,
          rejectionHint:
            "Check the feed IDs, their state and min_channel with get_symbols.",
          sessionContext,
          tool: "get_latest_price",
        },
        params.access_token,
        extra,
        async (ctx) => {
          const inputs = await resolveFeedInputs({
            catalog: "optional-router",
            historyClient,
            logger,
            priceFeedIds: params.price_feed_ids,
            symbols: params.symbols,
            token: ctx.token,
          });
          if (!inputs.ok) return ctx.fail(inputs.errorType, inputs.message);
          const { ids, resolvedSymbols, unresolvedSymbols } = inputs;
          ctx.setFeedsRequested(unresolvedSymbols?.length ?? ids.length);

          let latest: Awaited<ReturnType<RouterClient["getLatestPrice"]>>;
          try {
            latest = await routerClient.getLatestPrice(
              ctx.token,
              unresolvedSymbols,
              ids,
              params.properties,
              resolveChannel(params.channel, config),
            );
          } catch (err) {
            // Without the catalog, a bare pair reaches the Router as is and
            // is rejected; say why instead of echoing the Router.
            if (
              unresolvedSymbols &&
              err instanceof HttpError &&
              err.status === 400
            ) {
              return ctx.fail(
                "validation",
                `The feed catalog is unavailable, so symbols could not be resolved, and Pyth Pro rejected ${unresolvedSymbols.join(", ")}. Pass full symbols from get_symbols (e.g. Crypto.BTC/USD) or price_feed_ids.`,
              );
            }
            throw err;
          }

          const prices = latest.data.map((f) => addDisplayPrices(f));
          return ctx.succeed(
            {
              prices,
              ...(unresolvedSymbols ? {} : missingFeedsField(ids, latest.data)),
              ...resolvedSymbolsField(resolvedSymbols),
            },
            {
              numFeedsReturned: prices.length,
              upstreamLatencyMs:
                inputs.upstreamLatencyMs + latest.upstreamLatencyMs,
            },
          );
        },
      ),
  );
}
