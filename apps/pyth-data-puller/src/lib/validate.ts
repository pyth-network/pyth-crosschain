import { z } from "zod";
import { CHANNEL_RATES, MIN_CHANNEL_TO_NUMBER } from "./channels";

const VALID_CHANNELS = [1, 2, 3, 4] as const;

export const VALID_COLUMNS = [
  "price",
  "best_bid_price",
  "best_ask_price",
  "publisher_count",
  "confidence",
  "market_session",
  "exponent",
  "ema_price",
  "ema_confidence",
  "state",
  "funding_rate",
  "funding_timestamp",
  "funding_rate_interval_us",
] as const;

const MAX_ESTIMATED_ROWS = 50_000_000_000;
const MAX_FEEDS = 500;
const MAX_CLIENT_NAME_LENGTH = 200;

const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const CLIENT_NAME_REGEX = /^[a-zA-Z0-9 \-_]+$/;

export const exportRequestSchema = z.object({
  channel: z
    .number()
    .refine(
      (v): v is 1 | 2 | 3 | 4 =>
        (VALID_CHANNELS as readonly number[]).includes(v),
      {
        message: "Channel must be 1, 2, 3, or 4",
      },
    ),
  client_name: z
    .string()
    .min(1, "Client name is required")
    .max(
      MAX_CLIENT_NAME_LENGTH,
      `Client name must be under ${MAX_CLIENT_NAME_LENGTH} chars`,
    )
    .regex(
      CLIENT_NAME_REGEX,
      "Client name: only letters, numbers, spaces, hyphens, underscores",
    ),
  columns: z
    .array(z.enum(VALID_COLUMNS))
    .min(1, "At least one column is required"),
  end_dt: z
    .string()
    .regex(DATETIME_REGEX, "End date must be YYYY-MM-DD HH:MM:SS"),
  feed_ids: z
    .array(z.number().int().positive("Feed IDs must be positive integers"))
    .min(1, "At least one feed ID is required")
    .max(MAX_FEEDS, `Maximum ${MAX_FEEDS} feeds per export`),
  split_by_feed: z.boolean().optional().default(false),
  start_dt: z
    .string()
    .regex(DATETIME_REGEX, "Start date must be YYYY-MM-DD HH:MM:SS"),
});

/** Canonical Feed type — import this everywhere, don't redefine */
export type Feed = {
  pyth_lazer_id: number;
  symbol: string;
  name: string;
  description?: string;
  asset_type: string;
  min_channel?: string;
  exponent?: number;
  [key: string]: unknown;
};

export type ExportStatus = "queued" | "processing" | "completed" | "failed";

function parseUtcDate(dt: string): Date {
  return new Date(`${dt.replace(" ", "T")}Z`);
}

export function validateDateRange(
  startDt: string,
  endDt: string,
): string | null {
  const start = parseUtcDate(startDt);
  const end = parseUtcDate(endDt);

  if (Number.isNaN(start.getTime())) return "Invalid start date";
  if (Number.isNaN(end.getTime())) return "Invalid end date";
  if (end <= start) return "End date must be after start date";

  return null;
}

export function validateMinChannel(
  feedIds: number[],
  channel: number,
  feedMap: Map<number, Feed>,
): string | null {
  for (const feedId of feedIds) {
    const feed = feedMap.get(feedId);
    if (!feed) {
      return `Feed ID ${feedId} not found`;
    }
    if (feed.min_channel) {
      const minNum = MIN_CHANNEL_TO_NUMBER[feed.min_channel];
      if (minNum !== undefined && channel < minNum) {
        return `Feed "${feed.name}" (ID ${feedId}) requires minimum channel ${feed.min_channel}, but a faster channel was requested`;
      }
    }
  }

  return null;
}

export function estimateRowCount(
  channel: number,
  numFeeds: number,
  startDt: string,
  endDt: string,
): { rows: number; rangeSec: number; error: string | null } {
  const start = parseUtcDate(startDt);
  const end = parseUtcDate(endDt);
  const rangeSec = (end.getTime() - start.getTime()) / 1000;
  const rate = CHANNEL_RATES[channel] ?? 1;
  const rows = rangeSec * rate * numFeeds;

  if (rows > MAX_ESTIMATED_ROWS) {
    return {
      error: `Export too large (~${(rows / 1_000_000_000).toFixed(1)}B rows). Reduce date range, feeds, or use a slower channel.`,
      rangeSec,
      rows,
    };
  }

  return { error: null, rangeSec, rows };
}
