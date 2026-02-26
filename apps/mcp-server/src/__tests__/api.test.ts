/**
 * Tests for API clients
 * Uses mocked fetch for unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HermesClient } from '../api/hermes.js';
import { BenchmarksClient } from '../api/benchmarks.js';
import { ValidationError, InvalidFeedIdError, RateLimitError } from '../types/errors.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('HermesClient', () => {
  let client: HermesClient;

  beforeEach(() => {
    client = new HermesClient();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPriceFeeds', () => {
    it('should fetch and parse price feeds', async () => {
      const mockFeeds = [
        {
          id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
          attributes: {
            asset_type: 'crypto',
            base: 'BTC',
            description: 'BTC/USD',
            generic_symbol: 'BTCUSD',
            quote_currency: 'USD',
            symbol: 'Crypto.BTC/USD',
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeeds,
      });

      const feeds = await client.getPriceFeeds({ query: 'BTC' });

      expect(feeds).toHaveLength(1);
      expect(feeds[0].id).toBe(mockFeeds[0].id);
      expect(feeds[0].attributes.symbol).toBe('Crypto.BTC/USD');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/price_feeds?query=BTC'),
        expect.any(Object)
      );
    });

    it('should filter by asset type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getPriceFeeds({ assetType: 'crypto' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('asset_type=crypto'),
        expect.any(Object)
      );
    });
  });

  describe('getLatestPrices', () => {
    it('should fetch prices for valid feed IDs', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const mockResponse = {
        parsed: [
          {
            id: feedId,
            price: {
              price: '4235678900000',
              conf: '123456000',
              expo: -8,
              publish_time: 1704067200,
            },
            ema_price: {
              price: '4230000000000',
              conf: '100000000',
              expo: -8,
              publish_time: 1704067200,
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getLatestPrices({ feedIds: [feedId] });

      expect(result.parsed).toHaveLength(1);
      expect(result.parsed![0].price.price).toBe('4235678900000');
    });

    it('should reject empty feed ID array', async () => {
      await expect(client.getLatestPrices({ feedIds: [] })).rejects.toThrow(ValidationError);
    });

    it('should reject invalid feed ID format', async () => {
      await expect(client.getLatestPrices({ feedIds: ['invalid-id'] })).rejects.toThrow(
        InvalidFeedIdError
      );
    });

    it('should reject too many feed IDs', async () => {
      const tooManyIds = Array(101).fill(
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
      );

      await expect(client.getLatestPrices({ feedIds: tooManyIds })).rejects.toThrow(ValidationError);
    });
  });

  describe('getPriceAtTimestamp', () => {
    it('should fetch historical price', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const timestamp = 1704067200;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [
            {
              id: feedId,
              price: {
                price: '4200000000000',
                conf: '100000000',
                expo: -8,
                publish_time: timestamp,
              },
              ema_price: {
                price: '4190000000000',
                conf: '90000000',
                expo: -8,
                publish_time: timestamp,
              },
            },
          ],
        }),
      });

      const result = await client.getPriceAtTimestamp({
        feedIds: [feedId],
        timestamp,
      });

      expect(result.parsed).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v2/updates/price/${timestamp}`),
        expect.any(Object)
      );
    });

    it('should reject invalid timestamp', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

      await expect(
        client.getPriceAtTimestamp({
          feedIds: [feedId],
          timestamp: 0,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        client.getPriceAtTimestamp({
          feedIds: [feedId],
          timestamp: -1,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getTwap', () => {
    it('should fetch TWAP data', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: [
            {
              id: feedId,
              twap: {
                price: '4235000000000',
                conf: '100000000',
                expo: -8,
                publish_time: 1704067200,
              },
              start_time: 1704067140,
              end_time: 1704067200,
            },
          ],
        }),
      });

      const result = await client.getTwap({
        feedIds: [feedId],
        windowSeconds: 60,
      });

      expect(result.parsed).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('window_seconds=60'),
        expect.any(Object)
      );
    });

    it('should reject invalid window size', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

      await expect(
        client.getTwap({
          feedIds: [feedId],
          windowSeconds: 0,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        client.getTwap({
          feedIds: [feedId],
          windowSeconds: 601,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getPublisherStakeCaps', () => {
    it('should fetch publisher caps', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parsed: {
            publisher_stake_caps: [
              { publisher: '0x1234', cap: '1000000' },
              { publisher: '0x5678', cap: '2000000' },
            ],
          },
        }),
      });

      const result = await client.getPublisherStakeCaps();

      expect(result.parsed?.publisher_stake_caps).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '5']]),
      });

      await expect(client.getPriceFeeds()).rejects.toThrow(RateLimitError);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(client.getPriceFeeds()).rejects.toThrow();
    });
  });
});

describe('BenchmarksClient', () => {
  let client: BenchmarksClient;

  beforeEach(() => {
    client = new BenchmarksClient();
    mockFetch.mockReset();
  });

  describe('getPriceFeed', () => {
    it('should fetch feed by ID', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: feedId,
          attributes: {
            asset_type: 'crypto',
            base: 'BTC',
            description: 'BTC/USD',
            generic_symbol: 'BTCUSD',
            quote_currency: 'USD',
            symbol: 'Crypto.BTC/USD',
          },
        }),
      });

      const feed = await client.getPriceFeed(feedId);

      expect(feed.id).toBe(feedId);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/price_feeds/${feedId}`),
        expect.any(Object)
      );
    });
  });

  describe('getOHLCV', () => {
    it('should fetch OHLCV data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          t: [1704067200, 1704070800],
          o: [42000, 42100],
          h: [42500, 42300],
          l: [41800, 42000],
          c: [42100, 42200],
          v: [1000, 1200],
          s: 'ok',
        }),
      });

      const result = await client.getOHLCV('Crypto.BTC/USD', '60', 1704067200, 1704074400);

      expect(result.t).toHaveLength(2);
      expect(result.s).toBe('ok');
    });

    it('should reject invalid time range', async () => {
      await expect(client.getOHLCV('BTC', '60', 1704074400, 1704067200)).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject empty symbol', async () => {
      await expect(client.getOHLCV('', '60', 1704067200, 1704074400)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getHistoricalPrices', () => {
    it('should fetch historical price range', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            parsed: [
              {
                id: feedId,
                price: {
                  price: '4200000000000',
                  conf: '100000000',
                  expo: -8,
                  publish_time: 1704067200,
                },
                ema_price: {
                  price: '4190000000000',
                  conf: '90000000',
                  expo: -8,
                  publish_time: 1704067200,
                },
              },
            ],
          },
        ],
      });

      const result = await client.getHistoricalPrices({
        feedIds: [feedId],
        timestamp: 1704067200,
        interval: 3600,
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('searchSymbols', () => {
    it('should search for symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { symbol: 'BTC', full_name: 'Bitcoin', description: 'BTC/USD', type: 'crypto' },
        ],
      });

      const result = await client.searchSymbols('BTC');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BTC');
    });
  });
});
