#!/usr/bin/env node
/**
 * Code Mode-only MCP entrypoint — public hosted endpoint.
 * Exposes only search and execute. Use for mcp.pyth.network (or equivalent).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createCleanupHandler, createServerCodeModeOnly } from "./server.js";
import { createLogger, logSessionStart } from "./utils/logger.js";

const config = loadConfig();
const logger = createLogger(config);
const { server, sessionContext } = createServerCodeModeOnly(config, logger);

server.server.oninitialized = () => {
  const clientInfo = server.server.getClientVersion();
  if (clientInfo) {
    sessionContext.clientName = clientInfo.name;
    sessionContext.clientVersion = clientInfo.version;
  }

  logSessionStart(logger, {
    clientName: sessionContext.clientName,
    clientVersion: sessionContext.clientVersion,
    serverVersion: sessionContext.serverVersion,
    sessionId: sessionContext.sessionId,
  });
};

const cleanup = createCleanupHandler(server, logger, sessionContext);

const shutdown = async (exitCode = 0) => {
  await cleanup();
  process.exit(exitCode);
};

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
process.on("beforeExit", () => shutdown(0));
process.on("uncaughtException", async (err) => {
  logger.fatal({ err }, "uncaught exception");
  await shutdown(1);
});
process.on("unhandledRejection", async (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection");
  await shutdown(1);
});

const transport = new StdioServerTransport();
await server.connect(transport);
