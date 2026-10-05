import { createHash } from "node:crypto";
import type { Logger } from "pino";
import { pino } from "pino";
import type { Config } from "../config.js";
import { recordToolCallMetrics } from "../metrics.js";

// fetch quotes a rejected header value, token included, in its error.
// The quoted form goes first, since the token may contain a line break.
function redactBearer(text: string): string {
  return text
    .replace(/"Bearer [^"]*"/g, '"Bearer [REDACTED]"')
    .replace(/Bearer\s+(?!\[REDACTED\])\S+/g, "Bearer [REDACTED]");
}

export function serializeErrorRedacted(err: unknown) {
  const serialized = pino.stdSerializers.err(err as Error);
  if (!serialized || typeof serialized !== "object") return serialized;
  const out: Record<string, unknown> = { ...serialized };
  for (const key of ["message", "stack"] as const) {
    if (typeof out[key] === "string") out[key] = redactBearer(out[key]);
  }
  return out;
}

export function createLogger(config: Config): Logger {
  return pino({
    level: config.logLevel,
    serializers: { err: serializeErrorRedacted },
    transport: {
      options: { destination: 2 }, // stderr
      target: "pino/file",
    },
  });
}

export type ToolCallMetrics = {
  tool: string;
  status: "success" | "error";
  latencyMs: number;
  upstreamLatencyMs?: number;
  errorType?: string;
  apiKeyLast4?: string | null;
  tokenHash?: string | null;
  /** Where the key came from: the call, or the client configuration. */
  tokenSource?: string;
  clientName?: string;
  clientVersion?: string;
  sessionId?: string;
  requestId?: string | number;
  numFeedsRequested?: number;
  numFeedsReturned?: number;
  responseSizeBytes?: number;
};

export function logToolCall(logger: Logger, metrics: ToolCallMetrics): void {
  recordToolCallMetrics(metrics);
  logger.info({
    event: "tool_call",
    latency_ms: metrics.latencyMs,
    status: metrics.status,
    tool: metrics.tool,
    ...(metrics.upstreamLatencyMs != null && {
      upstream_latency_ms: metrics.upstreamLatencyMs,
    }),
    ...(metrics.errorType && { error_type: metrics.errorType }),
    ...(metrics.apiKeyLast4 !== undefined && {
      api_key_last4: metrics.apiKeyLast4,
    }),
    ...(metrics.tokenHash !== undefined && { token_hash: metrics.tokenHash }),
    ...(metrics.tokenSource && { token_source: metrics.tokenSource }),
    ...(metrics.clientName && { client_name: metrics.clientName }),
    ...(metrics.clientVersion && { client_version: metrics.clientVersion }),
    ...(metrics.sessionId && { session_id: metrics.sessionId }),
    ...(metrics.requestId != null && { request_id: metrics.requestId }),
    ...(metrics.numFeedsRequested != null && {
      num_feeds_requested: metrics.numFeedsRequested,
    }),
    ...(metrics.numFeedsReturned != null && {
      num_feeds_returned: metrics.numFeedsReturned,
    }),
    ...(metrics.responseSizeBytes != null && {
      response_size_bytes: metrics.responseSizeBytes,
    }),
  });
}

export type SessionStartInfo = {
  clientName?: string;
  clientVersion?: string;
  serverVersion: string;
  sessionId?: string;
};

export function logSessionStart(logger: Logger, info: SessionStartInfo): void {
  logger.info({
    client_name: info.clientName ?? "unknown",
    client_version: info.clientVersion ?? "unknown",
    event: "session_start",
    server_version: info.serverVersion,
    session_id: info.sessionId ?? "unknown",
  });
}

export type SessionEndInfo = {
  sessionId?: string;
  durationMs: number;
  totalToolCalls: number;
};

export function logSessionEnd(logger: Logger, info: SessionEndInfo): void {
  logger.info({
    duration_ms: info.durationMs,
    event: "session_end",
    session_id: info.sessionId ?? "unknown",
    total_tool_calls: info.totalToolCalls,
  });
}

/**
 * Compute a truncated SHA-256 hash of a token (first 16 hex chars).
 * Returns null if the token is undefined/empty.
 */
export function computeTokenHash(token?: string): string | null {
  if (!token) return null;
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * Extract the last 4 characters of a token for attribution.
 * Returns null if the token is undefined/empty.
 */
export function getApiKeyLast4(token?: string): string | null {
  if (!token || token.length < 4) return null;
  return token.slice(-4);
}
