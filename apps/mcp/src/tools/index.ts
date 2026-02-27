import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import type { HistoryClient } from "../clients/history.js";
import type { RouterClient } from "../clients/router.js";
import type { Config } from "../config.js";
import type { SessionContext } from "../server.js";
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
  sessionContext: SessionContext,
): void {
  registerGetSymbols(server, config, historyClient, logger, sessionContext);
  registerGetCandlestickData(
    server,
    config,
    historyClient,
    logger,
    sessionContext,
  );
  registerGetHistoricalPrice(
    server,
    config,
    historyClient,
    logger,
    sessionContext,
  );
  registerGetLatestPrice(server, config, routerClient, logger, sessionContext);
}
