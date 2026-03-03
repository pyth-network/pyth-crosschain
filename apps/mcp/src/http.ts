#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import {
  decrementActiveRequests,
  incrementActiveRequests,
  recordHttpRequest,
  registry,
} from "./metrics.js";
import { createServer } from "./server.js";
import { createLogger } from "./utils/logger.js";

const config = loadConfig();
const logger = createLogger(config);
const port = Number(process.env.PORT) || 8080;

const httpServer = createHttpServer(async (req, res) => {
  const start = Date.now();
  const method = req.method ?? "UNKNOWN";
  const url = req.url ?? "/";

  incrementActiveRequests();

  try {
    // Health check
    if (method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Prometheus metrics
    if (method === "GET" && url === "/metrics") {
      try {
        const metrics = await registry.metrics();
        res.writeHead(200, { "Content-Type": registry.contentType });
        res.end(metrics);
      } catch (err) {
        logger.error({ err }, "failed to collect metrics");
        res.writeHead(500);
        res.end("Internal Server Error");
      }
      return;
    }

    // MCP endpoint — only POST is supported in stateless mode
    if (url === "/mcp") {
      if (method !== "POST") {
        res.writeHead(405, { Allow: "POST" });
        res.end("Method Not Allowed");
        return;
      }

      const { server } = createServer(config, logger);
      const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: undefined,
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res);
      } catch (err) {
        logger.error({ err }, "MCP request handling failed");
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      } finally {
        await transport.close();
        await server.close();
      }
      return;
    }

    // Not found
    res.writeHead(404);
    res.end("Not Found");
  } finally {
    decrementActiveRequests();
    recordHttpRequest(method, url, res.statusCode, Date.now() - start);
  }
});

httpServer.listen(port, () => {
  logger.info({ port }, "MCP HTTP server started");
});

const shutdown = async () => {
  logger.info("shutting down HTTP server");
  await new Promise<void>((resolve, reject) =>
    httpServer.close((err) => (err ? reject(err) : resolve())),
  );
  await new Promise<void>((resolve) => logger.flush(() => resolve()));
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
