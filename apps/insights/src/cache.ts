import type { Cache as ACDCache } from "async-cache-dedupe";
import { createCache } from "async-cache-dedupe";
import { stringify, parse } from "superjson";

import { getRedis } from "./config/server";

const transformer = {
  serialize: stringify,
  deserialize: parse,
};

// export const DEFAULT_CACHE_TTL = 3600; // 1 hour
// export const DEFAULT_CACHE_STALE = 86_400; // 24 hours

export const DEFAULT_CACHE_TTL = 60; // 1 minute
export const DEFAULT_CACHE_STALE = 60; // 1 minute

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
