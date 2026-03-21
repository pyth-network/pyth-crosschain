import { CHANNEL_RATES } from "./validate";

const TARGET_FILE_BYTES = 500 * 1024 * 1024; // 500MB
const ROW_SIZE_ESTIMATE = 55; // avg bytes per CSV row
const TARGET_ROWS = Math.floor(TARGET_FILE_BYTES / ROW_SIZE_ESTIMATE);

export type SplitConfig = {
  feedGroupSize: number;
  batchMode: "none" | "day" | "minute" | "month";
  batchDays: number;
  batchMinutes: number;
};

/**
 * Auto-split algorithm:
 *
 * autoSplit(channel, numFeeds, rangeSec)
 * │
 * ├─ FEED SPLIT: numFeeds > 10 → feedGroupSize=1 (per feed)
 * │
 * ├─ TIME SPLIT: progressively smaller windows until file < 500MB
 * │   ├─ Total fits in one file → batchMode="none"
 * │   ├─ Daily fits → batchMode="day"
 * │   ├─ Hourly fits → batchMode="minute", batchMinutes=60
 * │   └─ Else → batchMode="minute", batchMinutes=1
 * │
 * └─ Return { feedGroupSize, batchMode, batchDays, batchMinutes }
 */
export function autoSplit(
  channel: number,
  numFeeds: number,
  rangeSec: number,
): SplitConfig {
  const ratePerSec = CHANNEL_RATES[channel] ?? 1;

  // Feed split decision
  const feedGroupSize = numFeeds > 10 ? 1 : 0;
  const effectiveFeeds = feedGroupSize === 1 ? 1 : numFeeds;

  // Total rows for one feed group over the full range
  const rowsPerGroup = rangeSec * ratePerSec * effectiveFeeds;

  if (rowsPerGroup <= TARGET_ROWS) {
    return { batchDays: 1, batchMinutes: 60, batchMode: "none", feedGroupSize };
  }

  // Try daily batches
  const dailyRows = 86_400 * ratePerSec * effectiveFeeds;
  if (dailyRows <= TARGET_ROWS) {
    return { batchDays: 1, batchMinutes: 60, batchMode: "day", feedGroupSize };
  }

  // Try hourly batches
  const hourlyRows = 3600 * ratePerSec * effectiveFeeds;
  if (hourlyRows <= TARGET_ROWS) {
    return {
      batchDays: 1,
      batchMinutes: 60,
      batchMode: "minute",
      feedGroupSize,
    };
  }

  // Fallback: 1-minute batches
  return { batchDays: 1, batchMinutes: 1, batchMode: "minute", feedGroupSize };
}

export function estimateFiles(
  config: SplitConfig,
  numFeeds: number,
  rangeSec: number,
): number {
  const feedGroups = config.feedGroupSize === 0 ? 1 : numFeeds;
  let timeBatches: number;

  switch (config.batchMode) {
    case "none":
      timeBatches = 1;
      break;
    case "day":
      timeBatches = Math.ceil(rangeSec / 86_400);
      break;
    case "minute":
      timeBatches = Math.ceil(rangeSec / (config.batchMinutes * 60));
      break;
    case "month":
      timeBatches = Math.ceil(rangeSec / (30 * 86_400));
      break;
  }

  return feedGroups * timeBatches;
}

export function estimateSize(
  channel: number,
  numFeeds: number,
  rangeSec: number,
): number {
  const ratePerSec = CHANNEL_RATES[channel] ?? 1;
  return rangeSec * ratePerSec * numFeeds * ROW_SIZE_ESTIMATE;
}
