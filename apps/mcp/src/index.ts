#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createCleanupHandler, createServer } from "./server.js";
import { createLogger, logSessionStart } from "./utils/logger.js";

const config = loadConfig();
const logger = createLogger(config);
const { server, sessionContext } = createServer(config, logger);

// Log session_start after the client completes the MCP handshake.
// server.connect() only sets up the transport — getClientVersion() isn't
// populated until the client sends the `initialized` notification.
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
