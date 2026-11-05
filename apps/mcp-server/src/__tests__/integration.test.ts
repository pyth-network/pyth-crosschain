/**
 * Integration tests against real Pyth APIs
 *
 * These tests hit the actual Pyth Hermes and Benchmarks APIs.
 * Skip in CI or when network is unavailable.
 *
 * Run with: npm test -- --run integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { HermesClient } from '../api/hermes.js';
import { BenchmarksClient } from '../api/benchmarks.js';

// Skip integration tests by default - run with RUN_INTEGRATION=true
const SKIP_INTEGRATION =
  process.env.RUN_INTEGRATION !== 'true' ||
  process.env.CI === 'true' ||
  process.env.SKIP_INTEGRATION === 'true';

// Known valid feed IDs
const BTC_USD_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
const ETH_USD_FEED_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';

describe.skipIf(SKIP_INTEGRATION)('Integration: Hermes API', () => {
  let client: HermesClient;

  beforeAll(() => {
    client = new HermesClient();
  });

  it('should fetch BTC price feed metadata', async () => {
    const feeds = await client.getPriceFeeds({ query: 'BTC' });

    expect(feeds.length).toBeGreaterThan(0);
    const btcFeed = feeds.find(f => f.attributes.symbol === 'Crypto.BTC/USD');
    expect(btcFeed).toBeDefined();
    expect(btcFeed?.id).toBe(BTC_USD_FEED_ID);
  });

  it('should fetch latest BTC price', async () => {
    const result = await client.getLatestPrices({
      feedIds: [BTC_USD_FEED_ID],
      parsed: true,
    });

    expect(result.parsed).toHaveLength(1);
    const price = result.parsed![0];
    // API may return ID with or without 0x prefix
    const normalizedId = price.id.toLowerCase().replace(/^0x/, '');
    expect(normalizedId).toBe(BTC_USD_FEED_ID.toLowerCase().replace(/^0x/, ''));

    // BTC should be worth more than $1000
    const priceValue = Number(price.price.price) * Math.pow(10, price.price.expo);
    expect(priceValue).toBeGreaterThan(1000);
  });

  it('should fetch multiple prices in one request', async () => {
    const result = await client.getLatestPrices({
      feedIds: [BTC_USD_FEED_ID, ETH_USD_FEED_ID],
      parsed: true,
    });

    expect(result.parsed).toHaveLength(2);
  });

  it('should fetch TWAP', async () => {
    const result = await client.getTwap({
      feedIds: [BTC_USD_FEED_ID],
      windowSeconds: 60,
    });

    expect(result.parsed).toHaveLength(1);
    expect(result.parsed![0]).toHaveProperty('twap');
    expect(result.parsed![0]).toHaveProperty('start_time');
    expect(result.parsed![0]).toHaveProperty('end_time');
  });

  it('should fetch publisher stake caps', async () => {
    const result = await client.getPublisherStakeCaps();

    expect(result.parsed).toBeDefined();
    expect(result.parsed?.publisher_stake_caps.length).toBeGreaterThan(0);
  });

  it('should filter by asset type', async () => {
    const cryptoFeeds = await client.getPriceFeeds({ assetType: 'crypto' });
    const fxFeeds = await client.getPriceFeeds({ assetType: 'fx' });

    expect(cryptoFeeds.length).toBeGreaterThan(0);
    expect(fxFeeds.length).toBeGreaterThan(0);

    // All crypto feeds should have crypto asset type
    for (const feed of cryptoFeeds.slice(0, 10)) {
      expect(feed.attributes.asset_type).toBe('crypto');
    }
  });
});

describe.skipIf(SKIP_INTEGRATION)('Integration: Benchmarks API', () => {
  let client: BenchmarksClient;

  beforeAll(() => {
    client = new BenchmarksClient();
  });

  it('should fetch feed by ID', async () => {
    const feed = await client.getPriceFeed(BTC_USD_FEED_ID);

    expect(feed.id).toBe(BTC_USD_FEED_ID);
    expect(feed.attributes.symbol).toBe('Crypto.BTC/USD');
  });

  it('should search symbols', async () => {
    const results = await client.searchSymbols('BTC');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.symbol.includes('BTC'))).toBe(true);
  });

  it('should fetch OHLCV data', async () => {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 86400;

    const result = await client.getOHLCV('Crypto.BTC/USD', 'D', dayAgo, now);

    expect(result.s).toBe('ok');
    expect(result.t.length).toBeGreaterThan(0);
  });
});

describe.skipIf(SKIP_INTEGRATION)('Integration: Error Handling', () => {
  let hermesClient: HermesClient;

  beforeAll(() => {
    hermesClient = new HermesClient();
  });

  it('should handle invalid feed ID gracefully', async () => {
    const invalidId = '0x0000000000000000000000000000000000000000000000000000000000000000';

    // Should either return empty parsed array or throw an error
    try {
      const result = await hermesClient.getLatestPrices({
        feedIds: [invalidId],
        parsed: true,
      });
      // If it doesn't throw, it should return empty or null data
      expect(result.parsed?.length ?? 0).toBe(0);
    } catch {
      // Expected - invalid feed ID
      expect(true).toBe(true);
    }
  });
});
