import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { HistoryClient } from "./clients/history.js";
import { RouterClient, verifyKeyWithRouter } from "./clients/router.js";
import type { Config } from "./config.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllTools } from "./tools/index.js";
import type { ClientAccessToken } from "./utils/access-token.js";
import { logSessionEnd } from "./utils/logger.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export { version };

/**
 * Shared session context passed to tool handlers for metrics attribution.
 */
export type SessionContext = {
  /** The user's key from their client config, for calls without one. Never log. */
  clientAccessToken?: ClientAccessToken;
  clientName?: string;
  clientVersion?: string;
  sessionId: string;
  serverVersion: string;
  sessionStartTime: number;
  toolCallCount: number;
};

/**
 * Creates an MCP server instance with all tools and resources registered.
 * Transport-agnostic — does not install process handlers or call process.exit().
 */
export function createServer(
  config: Config,
  logger: Logger,
  clientAccessToken?: ClientAccessToken,
): {
  server: McpServer;
  sessionContext: SessionContext;
} {
  const routerClient = new RouterClient(config, logger);
  const historyClient = new HistoryClient(config, logger, {
    verifyKey: (token) =>
      verifyKeyWithRouter(routerClient, config.routerUrl, token, logger),
  });

  const sessionContext: SessionContext = {
    clientAccessToken,
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

  return { server, sessionContext };
}

/**
 * Creates a cleanup handler for graceful shutdown.
 * The caller is responsible for installing this on process signals.
 */
export function createCleanupHandler(
  server: McpServer,
  logger: Logger,
  sessionContext: SessionContext,
): () => Promise<void> {
  let cleanedUp = false;
  return async () => {
    if (cleanedUp) return;
    cleanedUp = true;

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

    await new Promise<void>((resolve) => logger.flush(() => resolve()));
    await server.close();
  };
}
