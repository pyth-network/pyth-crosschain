import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { SessionContext } from "../server.js";
import { toolError } from "../utils/errors.js";
import { logToolCall } from "../utils/logger.js";
import {
  DATA_AVAILABLE_FROM_ISO,
  DATA_AVAILABLE_FROM_UNIX,
  getServerTime,
  unixSecondsToISO,
} from "../utils/timestamp.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;

const ConvertDateToTimestampInput = {
  date_string: z
    .string()
    .min(1)
    .max(64)
    .describe(
      "Date to convert. Must be ISO 8601 / RFC 3339 with timezone (e.g. '2026-01-01T00:00:00Z', '2026-01-01'). Bare dates without timezone are interpreted as UTC.",
    ),
};

export function registerConvertDateToTimestamp(
  server: McpServer,
  logger: Logger,
  sessionContext: SessionContext,
): void {
  server.registerTool(
    "convert_date_to_timestamp",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      description:
        "Convert a date string to Unix timestamp for use with get_historical_price and get_candlestick_data. Use this tool when you need to compute timestamps — do not calculate Unix timestamps manually. Accepts ISO 8601 dates (e.g. '2026-01-01', '2026-01-01T12:00:00Z'). Returns seconds, microseconds, ISO 8601, and whether the date is within the available data range (April 2025 onward).",
      inputSchema: ConvertDateToTimestampInput,
      title: "Convert Date to Timestamp",
    },
    (params, extra) => {
      sessionContext.toolCallCount++;
      const start = Date.now();

      const baseMetrics = {
        apiKeyLast4: null as null,
        clientName: sessionContext.clientName,
        clientVersion: sessionContext.clientVersion,
        requestId: extra.requestId,
        sessionId: extra.sessionId ?? sessionContext.sessionId,
        tokenHash: null as null,
        tool: "convert_date_to_timestamp" as const,
      };

      const input = params.date_string.trim();

      // Validate format: only ISO 8601 bare dates or datetimes with timezone
      const isBareDate = ISO_DATE_RE.test(input);
      const isISODatetime = ISO_DATETIME_RE.test(input);

      if (!isBareDate && !isISODatetime) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(
          "Invalid date format. Use ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        );
      }

      // Parse: bare dates get explicit UTC midnight, others parse directly
      const parsed = isBareDate
        ? new Date(`${input}T00:00:00Z`)
        : new Date(input);

      if (Number.isNaN(parsed.getTime())) {
        logToolCall(logger, {
          ...baseMetrics,
          errorType: "validation",
          latencyMs: Date.now() - start,
          status: "error",
        });
        return toolError(
          "Invalid date format. Use ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        );
      }

      // Round-trip check: validate the calendar date components independently
      // to catch silently normalized invalid dates (e.g. Feb 30 → Mar 2).
      // We construct a separate UTC Date from just year/month/day so this works
      // for all inputs, including offset datetimes where the parsed UTC date
      // legitimately differs from the input date.
      const dateMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, yearStr, monthStr, dayStr] = dateMatch;
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);
        const probe = new Date(Date.UTC(year, month - 1, day));
        if (
          probe.getUTCFullYear() !== year ||
          probe.getUTCMonth() + 1 !== month ||
          probe.getUTCDate() !== day
        ) {
          logToolCall(logger, {
            ...baseMetrics,
            errorType: "validation",
            latencyMs: Date.now() - start,
            status: "error",
          });
          return toolError(
            `Invalid calendar date: ${yearStr}-${monthStr}-${dayStr} does not exist. The date was normalized to ${probe.toISOString().slice(0, 10)}, which is not what you intended.`,
          );
        }
      }

      const unixSeconds = Math.floor(parsed.getTime() / 1000);
      const unixMicroseconds = parsed.getTime() * 1000;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const isInValidRange =
        unixSeconds >= DATA_AVAILABLE_FROM_UNIX && unixSeconds <= nowSeconds;

      const responseText = JSON.stringify({
        input,
        is_in_valid_range: isInValidRange,
        iso8601: parsed.toISOString(),
        unix_microseconds: unixMicroseconds,
        unix_seconds: unixSeconds,
        valid_range: {
          from_iso: DATA_AVAILABLE_FROM_ISO,
          from_unix: DATA_AVAILABLE_FROM_UNIX,
          to_iso: unixSecondsToISO(nowSeconds),
          to_unix: nowSeconds,
        },
        ...getServerTime(),
      });

      logToolCall(logger, {
        ...baseMetrics,
        latencyMs: Date.now() - start,
        responseSizeBytes: Buffer.byteLength(responseText),
        status: "success",
      });

      return {
        content: [{ text: responseText, type: "text" as const }],
      };
    },
  );
}
