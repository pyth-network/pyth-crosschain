import type { Cache as ACDCache } from "async-cache-dedupe";
import { createCache } from "async-cache-dedupe";
import { serialize, deserialize } from "superjson";

import { getRedis } from '../config/server';

// L2-backed cache: in-memory LRU (L1) + Redis (L2)
export const redisCache: ACDCache = createCache({
  transformer: {
    serialize,
    deserialize,
  },
  storage: {
    type: "redis",
    options: {
      client: getRedis(),
    },
  },
});

export const memoryOnlyCache: ACDCache = createCache({
  ttl: 5000,
  stale: 2000,
});