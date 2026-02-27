#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { logSessionStart } from "./utils/logger.js";

const config = loadConfig();
const { server, logger, sessionContext } = createServer(config);

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

const transport = new StdioServerTransport();
await server.connect(transport);
