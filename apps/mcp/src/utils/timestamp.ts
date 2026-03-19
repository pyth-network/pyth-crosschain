/** Earliest timestamp with available data: 2025-04-01T00:00:00Z */
export const DATA_AVAILABLE_FROM_UNIX = 1743465600;
export const DATA_AVAILABLE_FROM_ISO = "2025-04-01T00:00:00Z";

/** Convert Unix seconds to ISO 8601 string. */
export function unixSecondsToISO(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

/** Return current server time as both ISO and Unix seconds. */
export function getServerTime(): {
  server_time_utc: string;
  server_unix_seconds: number;
} {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    server_time_utc: unixSecondsToISO(nowSeconds),
    server_unix_seconds: nowSeconds,
  };
}

/**
 * Auto-detect timestamp unit and normalize to microseconds.
 * - <=10 digits: seconds -> multiply by 1,000,000
 * - 13 digits: milliseconds -> multiply by 1,000
 * - 16 digits: microseconds -> as-is
 */
export function normalizeTimestampToMicroseconds(ts: number): number {
  const digits = Math.floor(Math.log10(Math.abs(ts))) + 1;
  if (digits <= 10) return ts * 1_000_000; // seconds
  if (digits <= 13) return ts * 1000; // milliseconds
  return ts; // microseconds
}

/**
 * Round a microsecond timestamp down to the nearest channel interval.
 * For fixed_rate channels (e.g. fixed_rate@200ms), the API requires
 * the timestamp to be divisible by the channel rate in microseconds.
 * For real_time or unrecognized channels, returns the timestamp unchanged.
 */
export function alignTimestampToChannel(
  timestampUs: number,
  channel: string,
): number {
  const match = channel.match(/fixed_rate@(\d+)ms/);
  if (!match?.[1]) return timestampUs;
  const intervalUs = Number.parseInt(match[1], 10) * 1000;
  if (intervalUs <= 0) return timestampUs;
  return Math.floor(timestampUs / intervalUs) * intervalUs;
}
