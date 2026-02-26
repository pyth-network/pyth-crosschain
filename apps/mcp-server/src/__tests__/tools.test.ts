/**
 * Tests for MCP tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleToolCall } from '../tools/handlers.js';
import { TOOL_DEFINITIONS, getToolDefinition } from '../tools/definitions.js';

// Mock the API clients
vi.mock('../api/hermes.js', () => ({
  getHermesClient: () => ({
    getPriceFeeds: vi.fn().mockResolvedValue([
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
    ]),
    getLatestPrices: vi.fn().mockResolvedValue({
      parsed: [
        {
          id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
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
    }),
    getPriceAtTimestamp: vi.fn().mockResolvedValue({
      parsed: [
        {
          id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
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
    }),
    getTwap: vi.fn().mockResolvedValue({
      parsed: [
        {
          id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
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
    getPublisherStakeCaps: vi.fn().mockResolvedValue({
      parsed: {
        publisher_stake_caps: [
          { publisher: '0x1234', cap: '1000000' },
          { publisher: '0x5678', cap: '2000000' },
        ],
      },
    }),
  }),
}));

vi.mock('../api/benchmarks.js', () => ({
  getBenchmarksClient: () => ({
    getPriceFeed: vi.fn().mockResolvedValue({
      id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      attributes: {
        asset_type: 'crypto',
        base: 'BTC',
        description: 'BTC/USD',
        generic_symbol: 'BTCUSD',
        quote_currency: 'USD',
        symbol: 'Crypto.BTC/USD',
      },
    }),
    getHistoricalPrices: vi.fn().mockResolvedValue([
      {
        parsed: [
          {
            id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
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
    ]),
    getOHLCV: vi.fn().mockResolvedValue({
      t: [1704067200],
      o: [42000],
      h: [42500],
      l: [41800],
      c: [42100],
      s: 'ok',
    }),
    searchSymbols: vi.fn().mockResolvedValue([
      { symbol: 'BTC', full_name: 'Bitcoin', description: 'BTC/USD', type: 'crypto' },
    ]),
  }),
}));

describe('Tool Definitions', () => {
  it('should have all required tools defined', () => {
    const requiredTools = [
      'get_price_feeds',
      'get_latest_price',
      'get_price_at_timestamp',
      'get_ema_price',
      'get_twap',
      'get_publisher_caps',
      'get_price_feed_info',
      'get_historical_prices',
      'get_ohlcv',
      'search_symbols',
      'get_popular_feeds',
    ];

    for (const toolName of requiredTools) {
      const tool = getToolDefinition(toolName);
      expect(tool, `Tool ${toolName} should exist`).toBeDefined();
    }
  });

  it('should have annotations on all tools', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.annotations, `Tool ${tool.name} should have annotations`).toBeDefined();
      expect(tool.annotations).toHaveProperty('readOnlyHint', true);
      expect(tool.annotations).toHaveProperty('destructiveHint', false);
    }
  });

  it('should have descriptions on all tools', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.description, `Tool ${tool.name} should have description`).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('should have valid input schemas', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

describe('Tool Handlers', () => {
  describe('get_price_feeds', () => {
    it('should return formatted price feeds', async () => {
      const result = await handleToolCall('get_price_feeds', { query: 'BTC' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('totalFeeds');
      expect(result.data).toHaveProperty('feeds');
      expect(result.metadata).toHaveProperty('timestamp');
    });

    it('should work with asset_type filter', async () => {
      const result = await handleToolCall('get_price_feeds', { asset_type: 'crypto' });
      expect(result.success).toBe(true);
    });
  });

  describe('get_latest_price', () => {
    it('should return formatted price data', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = await handleToolCall('get_latest_price', { feed_ids: [feedId] });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('prices');
      const prices = (result.data as { prices: unknown[] }).prices;
      expect(prices).toHaveLength(1);
      expect(prices[0]).toHaveProperty('price');
      expect(prices[0]).toHaveProperty('priceFormatted');
      expect(prices[0]).toHaveProperty('confidence');
      expect(prices[0]).toHaveProperty('emaPrice');
    });
  });

  describe('get_price_at_timestamp', () => {
    it('should return historical price data', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = await handleToolCall('get_price_at_timestamp', {
        feed_ids: [feedId],
        timestamp: 1704067200,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('prices');
    });
  });

  describe('get_ema_price', () => {
    it('should return EMA price with deviation', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = await handleToolCall('get_ema_price', { feed_ids: [feedId] });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('emaPrices');
      const emaPrices = (result.data as { emaPrices: unknown[] }).emaPrices;
      expect(emaPrices[0]).toHaveProperty('emaPrice');
      expect(emaPrices[0]).toHaveProperty('currentPrice');
      expect(emaPrices[0]).toHaveProperty('deviationFromEma');
    });
  });

  describe('get_twap', () => {
    it('should return TWAP data', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = await handleToolCall('get_twap', {
        feed_ids: [feedId],
        window_seconds: 60,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('twapPrices');
      const twapPrices = (result.data as { twapPrices: unknown[] }).twapPrices;
      expect(twapPrices[0]).toHaveProperty('twapPrice');
      expect(twapPrices[0]).toHaveProperty('windowSeconds');
      expect(twapPrices[0]).toHaveProperty('startTime');
      expect(twapPrices[0]).toHaveProperty('endTime');
    });
  });

  describe('get_publisher_caps', () => {
    it('should return publisher data', async () => {
      const result = await handleToolCall('get_publisher_caps', {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('totalPublishers');
      expect(result.data).toHaveProperty('caps');
    });
  });

  describe('get_price_feed_info', () => {
    it('should return feed metadata', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = await handleToolCall('get_price_feed_info', { feed_id: feedId });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('symbol');
      expect(result.data).toHaveProperty('assetType');
    });
  });

  describe('get_historical_prices', () => {
    it('should return historical data range', async () => {
      const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = await handleToolCall('get_historical_prices', {
        feed_ids: [feedId],
        start_timestamp: 1704067200,
        interval_seconds: 3600,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('prices');
      expect(result.data).toHaveProperty('count');
    });
  });

  describe('get_ohlcv', () => {
    it('should return candlestick data', async () => {
      const result = await handleToolCall('get_ohlcv', {
        symbol: 'Crypto.BTC/USD',
        resolution: '60',
        from: 1704067200,
        to: 1704074400,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('symbol');
      expect(result.data).toHaveProperty('candles');
      expect(result.data).toHaveProperty('candleCount');
    });
  });

  describe('search_symbols', () => {
    it('should return search results', async () => {
      const result = await handleToolCall('search_symbols', { query: 'BTC' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('symbols');
      expect(result.data).toHaveProperty('resultCount');
    });
  });

  describe('get_popular_feeds', () => {
    it('should return popular feed IDs', async () => {
      const result = await handleToolCall('get_popular_feeds', { category: 'crypto' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('feeds');
      expect(result.data).toHaveProperty('networkStats');
    });

    it('should return all categories by default', async () => {
      const result = await handleToolCall('get_popular_feeds', {});

      expect(result.success).toBe(true);
      const feeds = (result.data as { feeds: unknown[] }).feeds;
      expect(feeds.length).toBeGreaterThan(5);
    });
  });

  describe('Unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await handleToolCall('nonexistent_tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_TOOL');
    });
  });
});
