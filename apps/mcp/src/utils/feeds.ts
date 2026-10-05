import type { Feed } from "../clients/types.js";

/** Retired feeds ("inactive") are hidden from listings by default. */
export function isActive(feed: Feed): boolean {
  return feed.state !== "inactive";
}

/** States no key can query (History 400s; the Router returns no row). */
export const NOT_LIVE_STATES: ReadonlySet<string> = new Set([
  "beta",
  "coming_soon",
  "inactive",
]);
