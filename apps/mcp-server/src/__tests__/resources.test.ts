/**
 * Tests for MCP resources
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReadResource } from '../resources/handlers.js';
import { RESOURCE_DEFINITIONS, getResourceDefinition } from '../resources/definitions.js';

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
      {
        id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        attributes: {
          asset_type: 'crypto',
          base: 'ETH',
          description: 'ETH/USD',
          generic_symbol: 'ETHUSD',
          quote_currency: 'USD',
          symbol: 'Crypto.ETH/USD',
        },
      },
    ]),
  }),
}));

describe('Resource Definitions', () => {
  it('should have all required resources defined', () => {
    const requiredResources = [
      'pyth://network/status',
      'pyth://feeds/catalog',
      'pyth://feeds/popular',
      'pyth://docs/api',
      'pyth://docs/integration',
    ];

    for (const uri of requiredResources) {
      const resource = getResourceDefinition(uri);
      expect(resource, `Resource ${uri} should exist`).toBeDefined();
    }
  });

  it('should have proper mime types', () => {
    const resource = getResourceDefinition('pyth://network/status');
    expect(resource?.mimeType).toBe('application/json');

    const docsResource = getResourceDefinition('pyth://docs/api');
    expect(docsResource?.mimeType).toBe('text/markdown');
  });

  it('should have descriptions on all resources', () => {
    for (const resource of RESOURCE_DEFINITIONS) {
      expect(resource.description, `Resource ${resource.uri} should have description`).toBeDefined();
      expect(resource.description.length).toBeGreaterThan(10);
    }
  });
});

describe('Resource Handlers', () => {
  describe('pyth://network/status', () => {
    it('should return network status JSON', async () => {
      const content = await handleReadResource('pyth://network/status');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('status');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('network');
      expect(parsed).toHaveProperty('endpoints');
      expect(parsed.network).toHaveProperty('name', 'Pyth Network');
    });

    it('should include supported chains', async () => {
      const content = await handleReadResource('pyth://network/status');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('supportedChains');
      expect(Array.isArray(parsed.supportedChains)).toBe(true);
      expect(parsed.supportedChains).toContain('Ethereum');
      expect(parsed.supportedChains).toContain('Solana');
    });

    it('should include health check info', async () => {
      const content = await handleReadResource('pyth://network/status');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('healthCheck');
      expect(parsed.healthCheck).toHaveProperty('feedsAvailable');
    });
  });

  describe('pyth://feeds/catalog', () => {
    it('should return feed catalog JSON', async () => {
      const content = await handleReadResource('pyth://feeds/catalog');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('totalFeeds');
      expect(parsed).toHaveProperty('byAssetType');
      expect(Array.isArray(parsed.byAssetType)).toBe(true);
    });

    it('should group feeds by asset type', async () => {
      const content = await handleReadResource('pyth://feeds/catalog');
      const parsed = JSON.parse(content);

      const cryptoCategory = parsed.byAssetType.find(
        (cat: { assetType: string }) => cat.assetType === 'crypto'
      );
      expect(cryptoCategory).toBeDefined();
      expect(cryptoCategory).toHaveProperty('count');
      expect(cryptoCategory).toHaveProperty('feeds');
    });
  });

  describe('pyth://feeds/popular', () => {
    it('should return popular feeds JSON', async () => {
      const content = await handleReadResource('pyth://feeds/popular');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('description');
      expect(parsed).toHaveProperty('feeds');
      expect(parsed).toHaveProperty('priceCalculation');
    });

    it('should include common assets', async () => {
      const content = await handleReadResource('pyth://feeds/popular');
      const parsed = JSON.parse(content);

      expect(parsed.feeds).toHaveProperty('crypto');
      expect(parsed.feeds.crypto).toHaveProperty('BTC/USD');
      expect(parsed.feeds.crypto).toHaveProperty('ETH/USD');
    });

    it('should include price calculation formula', async () => {
      const content = await handleReadResource('pyth://feeds/popular');
      const parsed = JSON.parse(content);

      expect(parsed.priceCalculation).toHaveProperty('formula');
      expect(parsed.priceCalculation).toHaveProperty('example');
    });
  });

  describe('pyth://docs/api', () => {
    it('should return API documentation markdown', async () => {
      const content = await handleReadResource('pyth://docs/api');

      expect(content).toContain('# Pyth Network API Reference');
      expect(content).toContain('Hermes API');
      expect(content).toContain('Benchmarks API');
      expect(content).toContain('https://hermes.pyth.network');
    });

    it('should include endpoint tables', async () => {
      const content = await handleReadResource('pyth://docs/api');

      expect(content).toContain('/v2/price_feeds');
      expect(content).toContain('/v2/updates/price/latest');
      expect(content).toContain('/v2/updates/twap/latest');
    });

    it('should include price calculation formula', async () => {
      const content = await handleReadResource('pyth://docs/api');

      expect(content).toContain('actual_price = price * 10^expo');
    });
  });

  describe('pyth://docs/integration', () => {
    it('should return integration guide markdown', async () => {
      const content = await handleReadResource('pyth://docs/integration');

      expect(content).toContain('# Pyth Network Integration Guide');
      expect(content).toContain('Best Practices');
    });

    it('should include confidence interval guidance', async () => {
      const content = await handleReadResource('pyth://docs/integration');

      expect(content).toContain('Confidence Intervals');
      expect(content).toContain('confidence');
    });

    it('should include TWAP guidance', async () => {
      const content = await handleReadResource('pyth://docs/integration');

      expect(content).toContain('TWAP');
      expect(content).toContain('Time-Weighted Average Price');
    });

    it('should include error handling section', async () => {
      const content = await handleReadResource('pyth://docs/integration');

      expect(content).toContain('Error Handling');
      expect(content).toContain('FEED_NOT_FOUND');
      expect(content).toContain('RATE_LIMITED');
    });
  });

  describe('Unknown resource', () => {
    it('should throw for unknown URI', async () => {
      await expect(handleReadResource('pyth://unknown/resource')).rejects.toThrow(
        'Unknown resource URI'
      );
    });
  });
});
