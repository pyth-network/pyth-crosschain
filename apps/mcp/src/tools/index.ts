import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import type { HistoryClient } from "../clients/history.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import { registerGetCandlestickData } from "./get-candlestick-data.js";
import { registerGetHistoricalPrice } from "./get-historical-price.js";
import { registerGetLatestPrice } from "./get-latest-price.js";
import { registerGetSymbols } from "./get-symbols.js";

export function registerAllTools(
  server: McpServer,
  config: Config,
  historyClient: HistoryClient,
  routerClient: RouterClient,
  logger: Logger,
): void {
  registerGetSymbols(server, config, historyClient, logger);
  registerGetCandlestickData(server, config, historyClient, logger);
  registerGetHistoricalPrice(server, config, historyClient, logger);
  registerGetLatestPrice(server, config, routerClient, logger);
}
