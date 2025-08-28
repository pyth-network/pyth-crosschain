import type { Cache as ACDCache } from "async-cache-dedupe";
import { createCache } from "async-cache-dedupe";
import { stringify, parse } from "superjson";

import { getRedis } from "./config/server";

const transformer = {
  serialize: stringify,
  deserialize: parse,
};

/**
 * - API routes will be cached for 1 hour
 * - Cached function will be cached for 10 minutes,
 * If the function is called within 1 hour, it will
 * still be served from the cache, but also fetch the latest data
 */
export const DEFAULT_NEXT_FETCH_TTL = 3600; // 1 hour
export const DEFAULT_REDIS_CACHE_TTL = 60 * 10; // 10 minutes
export const DEFAULT_REDIS_CACHE_STALE = 3600; // 1 hour

export const redisCache: ACDCache = createCache({
  transformer,
  stale: DEFAULT_REDIS_CACHE_STALE,
  ttl: DEFAULT_REDIS_CACHE_TTL,
  storage: {
    type: "redis",
    options: {
      client: getRedis(),
    },
  },
});
