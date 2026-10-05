import { createHash } from "node:crypto";
import { HttpError } from "./retry.js";
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
// A failed load (History down or timing out) is remembered briefly so that
// each new call does not wait out the timeout and retry again.
const FAILURE_TTL_MS = 30_000;
// Each entry holds a full parsed catalog, so keep the count small.
const MAX_ENTRIES = 10;

type Entry<T> = { expiresAt: number; value: T };
type Failure = { expiresAt: number; error: unknown };

export type TtlCacheOptions = {
  /** How long to remember a failed load; 0 (the default) never does. */
  failureTtlMs?: number;
  /** Keys that are never evicted to make room for others. */
  isPinned?: (key: string) => boolean;
  /** Which failures to remember; all of them by default. */
  shouldRememberFailure?: (error: unknown) => boolean;
};

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly failures = new Map<string, Failure>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly options: TtlCacheOptions = {},
  ) {}

  /**
   * Return the cached value for `key`, or load it. Concurrent callers for the
   * same key share one in-flight load. Only successful loads are stored, so
   * a failing load never evicts a good entry.
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
      return { hit: true, value: existing.value };
    }

    const failure = this.failures.get(key);
    if (failure && failure.expiresAt > now) throw failure.error;
    this.failures.delete(key);

    const pending = this.inFlight.get(key);
    if (pending) return { hit: true, value: await pending };

    const loading = load();
    this.inFlight.set(key, loading);
    try {
      const value = await loading;
      this.entries.delete(key);
      this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });
      this.evictOverflow(this.entries);
      return { hit: false, value };
    } catch (error) {
      this.rememberFailure(key, error);
      throw error;
    } finally {
      this.inFlight.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.failures.clear();
  }

  private rememberFailure(key: string, error: unknown): void {
    const ttl = this.options.failureTtlMs ?? 0;
    if (ttl <= 0) return;
    if (this.options.shouldRememberFailure?.(error) === false) return;
    this.failures.set(key, { error, expiresAt: Date.now() + ttl });
    this.evictOverflow(this.failures);
  }

  private evictOverflow(map: Map<string, unknown>): void {
    const isPinned = this.options.isPinned ?? (() => false);
    let unpinned = 0;
    for (const key of map.keys()) if (!isPinned(key)) unpinned++;
    const pinned = map.size - unpinned;
    // Oldest first: Map iteration follows insertion (and refresh) order.
    for (const key of map.keys()) {
      if (map.size <= Math.max(this.maxEntries, pinned)) return;
      if (!isPinned(key)) map.delete(key);
    }
  }
}

const ANONYMOUS = "anonymous";

/** Cache key that never contains the token itself. */
export function symbolsCacheKey(
  baseUrl: string,
  token: string | undefined,
  variant: string,
): string {
  const who = token
    ? createHash("sha256").update(token).digest("hex")
    : ANONYMOUS;
  return `${baseUrl}|${who}|${variant}`;
}

/**
 * Remember upstream outages (5xx, timeouts, network errors), not answers
 * about the token itself: a 4xx is cheap to repeat and may change.
 */
function isOutage(error: unknown): boolean {
  return !(error instanceof HttpError && error.status < 500);
}

const cacheOptions: TtlCacheOptions = {
  failureTtlMs: FAILURE_TTL_MS,
  // The public catalog serves every caller without a token. Never let a
  // stream of per-token loads (e.g. made-up tokens) evict it.
  isPinned: (key) => key.split("|")[1] === ANONYMOUS,
  shouldRememberFailure: isOutage,
};

export const symbolsCache = new TtlCache<Feed[]>(
  TTL_MS,
  MAX_ENTRIES,
  cacheOptions,
);

// Only feed IDs are kept for the entitled_only list, so entries are small.
export const entitledIdsCache = new TtlCache<ReadonlySet<number>>(TTL_MS, 100, {
  failureTtlMs: FAILURE_TTL_MS,
  shouldRememberFailure: isOutage,
});

/** Drop all cached catalogs (used by tests). */
export function clearSymbolsCache(): void {
  symbolsCache.clear();
  entitledIdsCache.clear();
}
