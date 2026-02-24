import type { Logger } from "pino";
import { pino } from "pino";
import type { Config } from "../config.js";

export function createLogger(config: Config): Logger {
  return pino({
    level: config.logLevel,
    transport: {
      options: { destination: 2 }, // stderr
      target: "pino/file",
    },
  });
}

export function logToolCall(
  logger: Logger,
  toolName: string,
  status: "success" | "error",
  latencyMs: number,
  hasToken: boolean,
  errorType?: string,
): void {
  logger.info({
    has_token: hasToken,
    latency_ms: latencyMs,
    status,
    tool: toolName,
    ...(errorType && { error_type: errorType }),
  });
}
