import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { HistoryClient } from "./clients/history.js";
import { RouterClient } from "./clients/router.js";
import type { Config } from "./config.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllTools } from "./tools/index.js";
import { createLogger, logSessionEnd } from "./utils/logger.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/**
 * Shared session context passed to tool handlers for metrics attribution.
 */
export type SessionContext = {
  clientName?: string;
  clientVersion?: string;
  sessionId: string;
  serverVersion: string;
  sessionStartTime: number;
  toolCallCount: number;
};

export function createServer(config: Config): {
  server: McpServer;
  logger: Logger;
  sessionContext: SessionContext;
} {
  const logger = createLogger(config);
  const historyClient = new HistoryClient(config, logger);
  const routerClient = new RouterClient(config, logger);

  const sessionContext: SessionContext = {
    serverVersion: version,
    sessionId: randomUUID(),
    sessionStartTime: Date.now(),
    toolCallCount: 0,
  };

  const server = new McpServer({
    name: "@pyth-network/mcp-server",
    version,
  });

  registerAllTools(
    server,
    config,
    historyClient,
    routerClient,
    logger,
    sessionContext,
  );
  registerAllResources(server, historyClient);

  let cleanedUp = false;
  const cleanup = async (exitCode = 0) => {
    if (cleanedUp) return;
    cleanedUp = true;

    // Capture client info from the SDK after handshake
    const clientInfo = server.server.getClientVersion();
    if (clientInfo) {
      sessionContext.clientName = clientInfo.name;
      sessionContext.clientVersion = clientInfo.version;
    }

    logSessionEnd(logger, {
      durationMs: Date.now() - sessionContext.sessionStartTime,
      sessionId: sessionContext.sessionId,
      totalToolCalls: sessionContext.toolCallCount,
    });

    // Flush pino's destination before exiting
    await new Promise<void>((resolve) => logger.flush(() => resolve()));

    await server.close();
    process.exit(exitCode);
  };
  process.on("SIGTERM", () => cleanup(0));
  process.on("SIGINT", () => cleanup(0));
  process.on("beforeExit", () => cleanup(0));
  process.on("uncaughtException", async (err) => {
    logger.fatal({ err }, "uncaught exception");
    await cleanup(1);
  });
  process.on("unhandledRejection", async (reason) => {
    logger.fatal({ err: reason }, "unhandled rejection");
    await cleanup(1);
  });

  return { logger, server, sessionContext };
}
