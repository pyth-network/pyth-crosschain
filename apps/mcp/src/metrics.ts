import { Counter, Gauge, Histogram, Registry } from "prom-client";
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

const upstreamLatency = new Histogram({
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  help: "Upstream API latency in seconds",
  labelNames: ["tool"] as const,
  name: "mcp_upstream_latency_seconds",
  registers: [registry],
});

const responseSizeBytes = new Histogram({
  buckets: [100, 500, 1000, 5000, 10_000, 50_000, 100_000],
  help: "MCP tool response size in bytes",
  labelNames: ["tool"] as const,
  name: "mcp_response_size_bytes",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Feed popularity metrics
// ---------------------------------------------------------------------------

const feedsRequestedTotal = new Counter({
  help: "Total number of price feeds requested across tool calls",
  labelNames: ["tool"] as const,
  name: "mcp_feeds_requested_total",
  registers: [registry],
});

const feedsReturnedTotal = new Counter({
  help: "Total number of price feeds returned across tool calls",
  labelNames: ["tool"] as const,
  name: "mcp_feeds_returned_total",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// HTTP-level metrics
// ---------------------------------------------------------------------------

const httpRequestsTotal = new Counter({
  help: "Total HTTP requests by method and path",
  labelNames: ["method", "path", "status_code"] as const,
  name: "mcp_http_requests_total",
  registers: [registry],
});

const httpRequestDuration = new Histogram({
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path"] as const,
  name: "mcp_http_request_duration_seconds",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Connection metrics
// ---------------------------------------------------------------------------

const activeRequests = new Gauge({
  help: "Number of in-flight HTTP requests currently being processed",
  name: "mcp_active_requests",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Client metrics
// ---------------------------------------------------------------------------

const clientRequestsTotal = new Counter({
  help: "Total requests by MCP client name",
  labelNames: ["client_name"] as const,
  name: "mcp_client_requests_total",
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

  if (metrics.upstreamLatencyMs != null) {
    upstreamLatency.observe(
      { tool: metrics.tool },
      metrics.upstreamLatencyMs / 1000,
    );
  }

  if (metrics.responseSizeBytes != null) {
    responseSizeBytes.observe(
      { tool: metrics.tool },
      metrics.responseSizeBytes,
    );
  }

  if (metrics.numFeedsRequested != null) {
    feedsRequestedTotal.inc(
      { tool: metrics.tool },
      metrics.numFeedsRequested,
    );
  }

  if (metrics.numFeedsReturned != null) {
    feedsReturnedTotal.inc(
      { tool: metrics.tool },
      metrics.numFeedsReturned,
    );
  }

  if (metrics.clientName) {
    clientRequestsTotal.inc({ client_name: metrics.clientName });
  }
}

export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): void {
  httpRequestsTotal.inc({
    method,
    path,
    status_code: String(statusCode),
  });
  httpRequestDuration.observe({ method, path }, durationMs / 1000);
}

export function incrementActiveRequests(): void {
  activeRequests.inc();
}

export function decrementActiveRequests(): void {
  activeRequests.dec();
}
