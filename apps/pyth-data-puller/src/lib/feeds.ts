import type { Feed } from "./validate";

let feedCache: { feeds: Feed[]; fetchedAt: number } | null = null;
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchFeeds(): Promise<Feed[]> {
  if (feedCache && Date.now() - feedCache.fetchedAt < FEED_CACHE_TTL) {
    return feedCache.feeds;
  }

  const res = await fetch("https://pyth-lazer.dourolabs.app/api/symbols");
  if (!res.ok) {
    throw new Error(`Failed to fetch feeds: ${res.status}`);
  }
  const feeds = (await res.json()) as Feed[];
  feedCache = { feeds, fetchedAt: Date.now() };
  return feeds;
}
