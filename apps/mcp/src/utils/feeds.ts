import type { Feed } from "../clients/types.js";

/** Retired feeds ("inactive") are hidden from listings by default. */
export function isActive(feed: Feed): boolean {
  return feed.state !== "inactive";
}
