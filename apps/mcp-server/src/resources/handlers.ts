/**
 * MCP Resource Handlers for Pyth Network
 */

import { getHermesClient } from '../api/hermes.js';
import { POPULAR_FEEDS, NETWORK_STATS } from '../api/config.js';

/**
 * Handle resource read requests
 */
export async function handleReadResource(uri: string): Promise<string> {
  switch (uri) {
    case 'pyth://network/status':
      return await getNetworkStatus();

    case 'pyth://feeds/catalog':
      return await getFeedsCatalog();

    case 'pyth://feeds/popular':
      return getPopularFeeds();

    case 'pyth://docs/api':
      return getApiDocs();

    case 'pyth://docs/integration':
      return getIntegrationGuide();

    default:
      throw new Error(`Unknown resource URI: ${uri}`);
  }
}

// ============================================================================
// Resource Handlers
// ============================================================================

async function getNetworkStatus(): Promise<string> {
  const client = getHermesClient();

  try {
    // Quick health check by fetching a small set of feeds
    const feeds = await client.getPriceFeeds({ query: 'BTC' });

    return JSON.stringify(
      {
        status: 'healthy',
        timestamp: Date.now(),
        network: {
          name: 'Pyth Network',
          description: 'Decentralized oracle network for real-time market data',
          ...NETWORK_STATS,
        },
        endpoints: {
          hermes: 'https://hermes.pyth.network',
          benchmarks: 'https://benchmarks.pyth.network',
          docs: 'https://docs.pyth.network',
        },
        supportedChains: [
          'Ethereum',
          'Solana',
          'Avalanche',
          'BNB Chain',
          'Polygon',
          'Arbitrum',
          'Optimism',
          'Base',
          'Aptos',
          'Sui',
          'Near',
          'Injective',
          'Osmosis',
          'Sei',
          // ... 107+ total
        ],
        healthCheck: {
          feedsAvailable: feeds.length > 0,
          sampleFeedsFound: feeds.length,
        },
      },
      null,
      2
    );
  } catch (error) {
    return JSON.stringify(
      {
        status: 'degraded',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      null,
      2
    );
  }
}

async function getFeedsCatalog(): Promise<string> {
  const client = getHermesClient();
  const feeds = await client.getPriceFeeds();

  // Group by asset type
  const grouped: Record<string, Array<{ id: string; symbol: string; description: string }>> = {};

  for (const feed of feeds) {
    const assetType = feed.attributes.asset_type || 'unknown';
    if (!grouped[assetType]) {
      grouped[assetType] = [];
    }
    grouped[assetType].push({
      id: feed.id,
      symbol: feed.attributes.symbol,
      description: feed.attributes.description,
    });
  }

  return JSON.stringify(
    {
      timestamp: Date.now(),
      totalFeeds: feeds.length,
      byAssetType: Object.entries(grouped).map(([type, feeds]) => ({
        assetType: type,
        count: feeds.length,
        feeds: feeds.slice(0, 20), // Limit to 20 per category for readability
      })),
    },
    null,
    2
  );
}

function getPopularFeeds(): string {
  return JSON.stringify(
    {
      timestamp: Date.now(),
      description: 'Commonly used Pyth price feed IDs',
      usage: 'Use these feed IDs with get_latest_price, get_twap, and other tools',
      feeds: POPULAR_FEEDS,
      priceCalculation: {
        formula: 'actual_price = price * 10^expo',
        example: 'price=4235678900000, expo=-8 means $42,356.789',
      },
    },
    null,
    2
  );
}

function getApiDocs(): string {
  return `# Pyth Network API Reference

## Hermes API (Real-time Data)

Base URL: \`https://hermes.pyth.network\`

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/v2/price_feeds\` | GET | List all available price feeds |
| \`/v2/updates/price/latest\` | GET | Get latest prices for feed IDs |
| \`/v2/updates/price/{timestamp}\` | GET | Get prices at specific timestamp |
| \`/v2/updates/twap/latest\` | GET | Get TWAP for feed IDs |
| \`/v2/updates/publisher_stake_caps/latest\` | GET | Publisher staking data |
| \`/v2/updates/price/stream\` | GET (SSE) | Stream real-time prices |

### Parameters

- \`ids[]\`: Price feed IDs (hex format, 0x-prefixed)
- \`encoding\`: \`hex\` or \`base64\`
- \`parsed\`: Include parsed price data (boolean)
- \`window_seconds\`: TWAP window (1-600)

## Benchmarks API (Historical Data)

Base URL: \`https://benchmarks.pyth.network\`

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/v1/price_feeds/\` | GET | List feeds with metadata |
| \`/v1/price_feeds/{id}\` | GET | Get feed details |
| \`/v1/updates/price/{timestamp}\` | GET | Historical price at timestamp |
| \`/v1/updates/price/{timestamp}/{interval}\` | GET | Historical price range |
| \`/v1/shims/tradingview/history\` | GET | OHLCV data |

## Price Calculation

\`\`\`
actual_price = price * 10^expo
confidence = conf * 10^expo
\`\`\`

Example: \`price=4235678900000, expo=-8\` = \`$42,356.789\`

## Rate Limits

- No authentication required
- Batch up to 100 feed IDs per request
- Use streaming for real-time data instead of polling
`;
}

function getIntegrationGuide(): string {
  return `# Pyth Network Integration Guide

## Best Practices

### 1. Use Universal Feed IDs

Pyth uses universal price feed identifiers that work across all 107+ supported blockchains.
No need for chain-specific addresses.

\`\`\`
BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
\`\`\`

### 2. Handle Confidence Intervals

Every Pyth price includes a confidence interval representing uncertainty:

\`\`\`
price: $42,356.78
confidence: $12.50 (0.03%)
\`\`\`

- Tight confidence = high certainty
- Wide confidence = market volatility or thin liquidity

### 3. Use TWAP for Trading

Time-Weighted Average Price (TWAP) reduces manipulation risk:

\`\`\`
Regular price: Subject to instantaneous manipulation
5-minute TWAP: Averaged over 300 seconds, harder to manipulate
\`\`\`

### 4. Check Publish Time

Always verify the publish_time is recent:

\`\`\`
current_time - publish_time < 60 seconds (recommended)
\`\`\`

Stale prices may indicate network issues.

### 5. Batch Requests

Fetch multiple prices in one request (up to 100 IDs):

\`\`\`
get_latest_price(["BTC/USD", "ETH/USD", "SOL/USD"])
\`\`\`

### 6. Use Streaming for Real-time

For live price monitoring, use SSE streaming instead of polling.
Updates arrive every ~400ms.

## Common Patterns

### Portfolio Valuation

1. Get current prices for all assets
2. Apply confidence intervals for risk bounds
3. Use EMA prices for smoothed values

### Price Alerts

1. Subscribe to price stream
2. Compare against thresholds
3. Use TWAP to avoid false alerts from spikes

### Historical Analysis

1. Use Benchmarks API for past data
2. OHLCV endpoint for charting
3. Interval queries for backtesting

## Error Handling

- **FEED_NOT_FOUND**: Invalid or discontinued feed ID
- **RATE_LIMITED**: Too many requests, implement backoff
- **STALE_PRICE**: Data older than acceptable threshold
`;
}
