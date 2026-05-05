// Canonical channel constants — imported by both server and client code.
// Single source of truth to prevent drift.

export const CHANNELS = [
  { label: "Channel 1 — Real-time (~1ms)", value: 1 },
  { label: "Channel 2 — fixed_rate@50ms", value: 2 },
  { label: "Channel 3 — fixed_rate@200ms", value: 3 },
  { label: "Channel 4 — fixed_rate@1000ms (1s)", value: 4 },
] as const;

/** Rows per second per feed for each channel */
export const CHANNEL_RATES: Record<number, number> = {
  1: 1000,
  2: 20,
  3: 5,
  4: 1,
};

/** Human-readable channel labels for display */
export const CHANNEL_LABELS: Record<number, string> = {
  1: "RT (1ms)",
  2: "50ms",
  3: "200ms",
  4: "1s",
};

/** Human-readable channel labels for manifest/export metadata */
export const CHANNEL_DISPLAY: Record<number, string> = {
  1: "Real-time (~1ms)",
  2: "50ms",
  3: "200ms",
  4: "1000ms (1s)",
};

/**
 * Maps min_channel string from API → channel number.
 * Lower number = faster. Feed with min_channel="fixed_rate@200ms" (3)
 * works on channels 3,4 but not 1,2.
 */
export const MIN_CHANNEL_TO_NUMBER: Record<string, number> = {
  fixed_rate_50ms: 2,
  fixed_rate_200ms: 3,
  fixed_rate_1000ms: 4,
  "fixed_rate@50ms": 2,
  "fixed_rate@200ms": 3,
  "fixed_rate@1000ms": 4,
  real_time: 1,
};

/** Average bytes per CSV row for size estimation */
export const ROW_SIZE_ESTIMATE = 55;
