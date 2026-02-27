#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { logSessionStart } from "./utils/logger.js";

const config = loadConfig();
const { server, logger, sessionContext } = createServer(config);

const transport = new StdioServerTransport();
await server.connect(transport);

// After connect, the MCP handshake is complete — capture client info
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
