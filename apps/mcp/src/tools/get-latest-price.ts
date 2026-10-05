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
import { resolveFeedInputs, runPriceTool } from "./price-tool.js";

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
