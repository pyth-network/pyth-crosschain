import { createHash } from "node:crypto";
import type { Feed } from "./types.js";

/**
 * Short-lived cache for /v1/symbols responses. The authenticated catalog is
 * several MB, and get_symbols / symbol resolution would otherwise refetch it
 * on every call.
 *
 * Module-level on purpose: HTTP mode builds a new server (and HistoryClient)
 * per request, so a per-instance cache would never hit.
 */
const TTL_MS = 5 * 60_000;
// Each entry holds a full parsed catalog, so keep the count small.
const MAX_ENTRIES = 10;

type Entry<T> = { expiresAt: number; value: Promise<T> };

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  /**
   * Return the cached value for `key`, or load it. Concurrent callers for the
   * same key share one in-flight load. Failed loads are not cached.
   */
  async getOrLoad(
    key: string,
    load: () => Promise<T>,
  ): Promise<{ hit: boolean; value: T }> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > now) {
      // Refresh recency for LRU eviction.
      this.entries.delete(key);
      this.entries.set(key, existing);
      return { hit: true, value: await existing.value };
    }

    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { expiresAt: now + this.ttlMs, value });
    this.evictOverflow();
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    return { hit: false, value: await value };
  }

  clear(): void {
    this.entries.clear();
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
    }
  }
}

/** Cache key that never contains the token itself. */
export function symbolsCacheKey(
  baseUrl: string,
  token: string | undefined,
  variant: string,
): string {
  const who = token
    ? createHash("sha256").update(token).digest("hex")
    : "anonymous";
  return `${baseUrl}|${who}|${variant}`;
}

export const symbolsCache = new TtlCache<Feed[]>(TTL_MS, MAX_ENTRIES);

/** Drop all cached catalogs (used by tests). */
export function clearSymbolsCache(): void {
  symbolsCache.clear();
}
