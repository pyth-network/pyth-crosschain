import type { Cache as ACDCache } from "async-cache-dedupe";
import { createCache } from "async-cache-dedupe";
import { stringify, parse } from "superjson";

import { getRedis } from '../config/server';

const transformer = {
  serialize: stringify,
  deserialize: parse,
};

export const DEFAULT_CACHE_TTL = 86_400; // 24 hours
export const DEFAULT_CACHE_STALE = 86_400; // 24 hours

export const redisCache: ACDCache = createCache({
  transformer,
  stale: DEFAULT_CACHE_STALE,
  ttl: DEFAULT_CACHE_TTL,
  storage: {
    type: "redis",
    options: {
      client: getRedis(),
    },
  },
});

export const memoryOnlyCache: ACDCache = createCache({
  ttl: DEFAULT_CACHE_TTL,
  stale: DEFAULT_CACHE_STALE,
});
