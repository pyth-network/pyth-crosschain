import { z } from "zod";

const VALID_CHANNELS = [1, 2, 3, 4] as const;

const VALID_COLUMNS = [
  "price",
  "best_bid_price",
  "best_ask_price",
  "publisher_count",
  "confidence",
  "market_session",
] as const;

const CHANNEL_RATES: Record<number, number> = {
  1: 1000, // real-time: ~1ms
  2: 20, // fixed_rate@50ms
  3: 5, // fixed_rate@200ms
  4: 1, // fixed_rate@1000ms
};

const MAX_ESTIMATED_ROWS = 50_000_000_000;
const MAX_FEEDS = 500;
const MAX_CLIENT_NAME_LENGTH = 200;

const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const CLIENT_NAME_REGEX = /^[a-zA-Z0-9 \-_]+$/;

export const exportRequestSchema = z.object({
  channel: z
    .number()
    .refine((v): v is 1 | 2 | 3 | 4 => VALID_CHANNELS.includes(v as 1), {
      message: "Channel must be 1, 2, 3, or 4",
    }),
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
  start_dt: z
    .string()
    .regex(DATETIME_REGEX, "Start date must be YYYY-MM-DD HH:MM:SS"),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export type Feed = {
  pyth_lazer_id: number;
  symbol: string;
  name: string;
  description?: string;
  asset_type: string;
  min_channel?: number;
  exponent?: number;
  [key: string]: unknown;
};

export function validateDateRange(
  startDt: string,
  endDt: string,
): string | null {
  const start = new Date(startDt.replace(" ", "T"));
  const end = new Date(endDt.replace(" ", "T"));

  if (Number.isNaN(start.getTime())) return "Invalid start date";
  if (Number.isNaN(end.getTime())) return "Invalid end date";
  if (end <= start) return "End date must be after start date";

  return null;
}

export function validateMinChannel(
  feedIds: number[],
  channel: number,
  feeds: Feed[],
): string | null {
  const feedMap = new Map(feeds.map((f) => [f.pyth_lazer_id, f]));

  for (const id of feedIds) {
    const feed = feedMap.get(id);
    if (!feed) {
      return `Feed ID ${id} not found`;
    }
    if (feed.min_channel !== undefined && feed.min_channel > channel) {
      return `Feed "${feed.name}" (ID ${id}) requires minimum channel ${feed.min_channel}, but channel ${channel} was requested`;
    }
  }

  return null;
}

export function estimateRowCount(
  channel: number,
  numFeeds: number,
  startDt: string,
  endDt: string,
): { rows: number; error: string | null } {
  const start = new Date(startDt.replace(" ", "T"));
  const end = new Date(endDt.replace(" ", "T"));
  const rangeSec = (end.getTime() - start.getTime()) / 1000;
  const rate = CHANNEL_RATES[channel] ?? 1;
  const rows = rangeSec * rate * numFeeds;

  if (rows > MAX_ESTIMATED_ROWS) {
    return {
      error: `Export too large (~${(rows / 1_000_000_000).toFixed(1)}B rows). Reduce date range, feeds, or use a slower channel.`,
      rows,
    };
  }

  return { error: null, rows };
}

export function getRangeSeconds(startDt: string, endDt: string): number {
  const start = new Date(startDt.replace(" ", "T"));
  const end = new Date(endDt.replace(" ", "T"));
  return (end.getTime() - start.getTime()) / 1000;
}

export { CHANNEL_RATES, VALID_COLUMNS };
