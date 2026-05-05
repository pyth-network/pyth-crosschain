import { CHANNEL_RATES, ROW_SIZE_ESTIMATE } from "./channels";

const TARGET_FILE_BYTES = 500 * 1024 * 1024; // 500MB
const TARGET_ROWS = Math.floor(TARGET_FILE_BYTES / ROW_SIZE_ESTIMATE);

export type SplitConfig = {
  feedGroupSize: number;
  batchMode: "none" | "day" | "minute";
  batchDays: number;
  batchMinutes: number;
};

/**
 * Auto-split algorithm:
 *
 * autoSplit(channel, numFeeds, rangeSec)
 * │
 * ├─ FEED SPLIT: numFeeds > 10 or user flag → feedGroupSize=1 (per feed)
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
  splitByFeed = false,
): SplitConfig {
  const ratePerSec = CHANNEL_RATES[channel] ?? 1;

  const feedGroupSize = splitByFeed || numFeeds > 10 ? 1 : 0;
  const effectiveFeeds = feedGroupSize === 1 ? 1 : numFeeds;

  const rowsPerGroup = rangeSec * ratePerSec * effectiveFeeds;

  if (rowsPerGroup <= TARGET_ROWS) {
    return { batchDays: 1, batchMinutes: 60, batchMode: "none", feedGroupSize };
  }

  const dailyRows = 86_400 * ratePerSec * effectiveFeeds;
  if (dailyRows <= TARGET_ROWS) {
    return { batchDays: 1, batchMinutes: 60, batchMode: "day", feedGroupSize };
  }

  const hourlyRows = 3600 * ratePerSec * effectiveFeeds;
  if (hourlyRows <= TARGET_ROWS) {
    return {
      batchDays: 1,
      batchMinutes: 60,
      batchMode: "minute",
      feedGroupSize,
    };
  }

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
