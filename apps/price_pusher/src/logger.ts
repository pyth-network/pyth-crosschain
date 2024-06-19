import pino from "pino";
import { Logger, Level } from "pino";
import { Logger as LoggerInterface } from "ts-log";
export { Logger } from "pino";

export type LogFormat = "json" | "pretty";

export function createLogger(logLevel?: Level, logFormat?: LogFormat): Logger {
  return pino({
    level: logLevel ?? "info",
    transport:
      logFormat === "pretty"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              ignore: "pid,hostname",
            },
          }
        : undefined,
  });
}

export function createPriceServiceConnectionLogger(
  logger: Logger
): LoggerInterface {
  return {
    trace: logger.trace.bind(logger),
    debug: logger.debug.bind(logger),
    // Use debug level here because the info level is too noisy
    info: logger.debug.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
}
