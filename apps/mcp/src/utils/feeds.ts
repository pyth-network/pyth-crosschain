import type { Feed } from "../clients/types.js";

/** Retired feeds ("inactive") are hidden from listings by default. */
export function isActive(feed: Feed): boolean {
  return feed.state !== "inactive";
}

/**
 * Feed states that cannot be queried yet (or any more). Verified live:
 * History answers 400 "not ready. Currently in beta state" for beta and
 * coming_soon feeds, and the Router returns no row for them.
 */
export const NOT_LIVE_STATES: ReadonlySet<string> = new Set([
  "beta",
  "coming_soon",
  "inactive",
]);
