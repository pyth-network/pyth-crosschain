import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import { HttpError } from "../clients/retry.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import { resolveChannel } from "../utils/channel.js";
import { addDisplayPrices } from "../utils/display-price.js";
import { ErrorMessages, toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";
import { channelParam } from "./schemas.js";

const GetLatestPriceInput = {
  access_token: z
    .string()
    .optional()
    .describe("Pyth Pro access token. Get one at https://pyth.network/pricing"),
  channel: channelParam,
  price_feed_ids: z
    .array(z.coerce.number().int().positive())
    .max(100)
    .optional()
    .describe("Numeric feed IDs from get_symbols"),
  properties: z
    .array(z.string())
    .optional()
    .describe(
      "Properties to return. Default: price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount",
    ),
  symbols: z
    .array(z.string())
    .max(100)
    .optional()
    .describe(
      "Full symbol names from get_symbols including asset type prefix (e.g. ['Crypto.BTC/USD', 'Equity.US.AAPL/USD'])",
    ),
};

export function registerGetLatestPrice(
  server: McpServer,
  config: Config,
  routerClient: RouterClient,
  logger: Logger,
): void {
  server.registerTool(
    "get_latest_price",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description:
        "Get the most recent real-time price for one or more feeds. Requires an `access_token` parameter (get one at https://docs.pyth.network/price-feeds/pro/acquire-access-token). Use get_symbols first to find symbols or feed IDs. IMPORTANT: symbols must be the full name including asset type prefix (e.g. 'Crypto.BTC/USD', not 'BTC/USD'). Prices are integers with an exponent field — human-readable price = price * 10^exponent. Pre-computed display_price fields are included for convenience.",
      inputSchema: GetLatestPriceInput,
    },
    async (params) => {
      const start = Date.now();

      if (
        !(params.symbols?.length ?? 0) &&
        !(params.price_feed_ids?.length ?? 0)
      ) {
        logToolCall(
          logger,
          "get_latest_price",
          "error",
          Date.now() - start,
          false,
          "validation",
        );
        return toolError(
          "At least one of 'symbols' or 'price_feed_ids' is required",
        );
      }

      if (
        (params.symbols?.length ?? 0) + (params.price_feed_ids?.length ?? 0) >
        100
      ) {
        logToolCall(
          logger,
          "get_latest_price",
          "error",
          Date.now() - start,
          false,
          "validation",
        );
        return toolError(
          "Combined total of symbols and price_feed_ids must not exceed 100",
        );
      }

      if (!params.access_token) {
        logToolCall(
          logger,
          "get_latest_price",
          "error",
          Date.now() - start,
          false,
          "auth",
        );
        return toolError(ErrorMessages.MISSING_TOKEN);
      }

      const channel = resolveChannel(params.channel, config);

      try {
        const feeds = await routerClient.getLatestPrice(
          params.access_token,
          params.symbols,
          params.price_feed_ids,
          params.properties,
          channel,
        );

        const enriched = feeds.map((f) => addDisplayPrices(f));

        logToolCall(
          logger,
          "get_latest_price",
          "success",
          Date.now() - start,
          true,
        );
        return {
          content: [{ text: JSON.stringify(enriched), type: "text" as const }],
        };
      } catch (err) {
        const errorType =
          err instanceof HttpError && err.status === 403 ? "auth" : "upstream";

        logToolCall(
          logger,
          "get_latest_price",
          "error",
          Date.now() - start,
          true,
          errorType,
        );

        if (err instanceof HttpError && err.status === 403) {
          return toolError(ErrorMessages.INVALID_TOKEN);
        }

        logger.warn({ err }, "get_latest_price upstream error");
        return toolError("Failed to fetch latest price. Please try again.");
      }
    },
  );
}
