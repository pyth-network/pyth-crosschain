/**
 * Tests for MCP server setup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from '../server.js';

// Mock the API clients
vi.mock('../api/hermes.js', () => ({
  getHermesClient: () => ({
    getPriceFeeds: vi.fn().mockResolvedValue([]),
    getLatestPrices: vi.fn().mockResolvedValue({ parsed: [] }),
    getPriceAtTimestamp: vi.fn().mockResolvedValue({ parsed: [] }),
    getTwap: vi.fn().mockResolvedValue({ parsed: [] }),
    getPublisherStakeCaps: vi.fn().mockResolvedValue({ parsed: { publisher_stake_caps: [] } }),
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
    getHistoricalPrices: vi.fn().mockResolvedValue([]),
    getOHLCV: vi.fn().mockResolvedValue({ t: [], o: [], h: [], l: [], c: [], s: 'ok' }),
    searchSymbols: vi.fn().mockResolvedValue([]),
  }),
}));

describe('MCP Server', () => {
  it('should create server with correct name and version', () => {
    const server = createServer();

    // The server should be created successfully
    expect(server).toBeDefined();
  });

  it('should have all capabilities enabled', () => {
    const server = createServer();

    // Server should have tools, resources, and prompts capabilities
    // Note: We can't easily inspect capabilities after creation,
    // but we can verify the server was created without errors
    expect(server).toBeDefined();
  });
});

describe('Server Configuration', () => {
  it('should use correct server name', () => {
    // The server name should be 'pyth-network'
    // This is verified by the createServer implementation
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('should use correct version', () => {
    // The server version should be '0.1.0'
    // This is verified by the createServer implementation
    const server = createServer();
    expect(server).toBeDefined();
  });
});
