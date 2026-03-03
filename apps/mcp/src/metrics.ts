import { Counter, Histogram, Registry } from "prom-client";
import type { ToolCallMetrics } from "./utils/logger.js";

export const registry = new Registry();
registry.setDefaultLabels({ app: "mcp_server" });

// ---------------------------------------------------------------------------
// Tool-level metrics
// ---------------------------------------------------------------------------

const toolCallsTotal = new Counter({
  help: "Total number of MCP tool calls",
  labelNames: ["tool", "status"] as const,
  name: "mcp_tool_calls_total",
  registers: [registry],
});

const toolCallErrorsTotal = new Counter({
  help: "Total number of MCP tool call errors by type",
  labelNames: ["tool", "error_type"] as const,
  name: "mcp_tool_call_errors_total",
  registers: [registry],
});

const toolCallDuration = new Histogram({
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  help: "MCP tool call duration in seconds",
  labelNames: ["tool"] as const,
  name: "mcp_tool_call_duration_seconds",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// HTTP-level metrics
// ---------------------------------------------------------------------------

const KNOWN_PATHS = new Set(["/health", "/metrics", "/mcp"]);

function normalizePath(url: string): string {
  const idx = url.indexOf("?");
  const path = idx === -1 ? url : url.slice(0, idx);
  return KNOWN_PATHS.has(path) ? path : "/__other__";
}

const httpRequestsTotal = new Counter({
  help: "Total HTTP requests by method and path",
  labelNames: ["method", "path", "status_code"] as const,
  name: "mcp_http_requests_total",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Recording functions
// ---------------------------------------------------------------------------

export function recordToolCallMetrics(metrics: ToolCallMetrics): void {
  toolCallsTotal.inc({ tool: metrics.tool, status: metrics.status });
  toolCallDuration.observe(
    { tool: metrics.tool },
    metrics.latencyMs / 1000,
  );

  if (metrics.status === "error" && metrics.errorType) {
    toolCallErrorsTotal.inc({
      tool: metrics.tool,
      error_type: metrics.errorType,
    });
  }
}

export function recordHttpRequest(
  method: string,
  rawUrl: string,
  statusCode: number,
): void {
  httpRequestsTotal.inc({
    method,
    path: normalizePath(rawUrl),
    status_code: String(statusCode),
  });
}
