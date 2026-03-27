import { z } from "zod";
import type { Feed } from "./validate";

const feedSchema = z
  .object({
    asset_type: z.string(),
    description: z.string().optional(),
    exponent: z.number().optional(),
    min_channel: z.string().optional(),
    name: z.string(),
    pyth_lazer_id: z.number(),
    symbol: z.string(),
  })
  .passthrough();

const feedsResponseSchema = z.array(feedSchema);

let feedCache: { feeds: Feed[]; fetchedAt: number } | null = null;
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchFeeds(): Promise<Feed[]> {
  if (feedCache && Date.now() - feedCache.fetchedAt < FEED_CACHE_TTL) {
    return feedCache.feeds;
  }

  const res = await fetch(
    "https://history.pyth-lazer.dourolabs.app/v1/symbols",
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch feeds: ${res.status}`);
  }

  const raw = await res.json();
  const feeds = feedsResponseSchema.parse(raw) as Feed[];
  feedCache = { feeds, fetchedAt: Date.now() };
  return feeds;
}

/** Build a Map for O(1) lookups by feed ID */
export function buildFeedMap(feeds: Feed[]): Map<number, Feed> {
  return new Map(feeds.map((f) => [f.pyth_lazer_id, f]));
}
