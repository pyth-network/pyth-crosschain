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
