/**
 * MCP Tool Definitions for Pyth Network
 *
 * IMPORTANT: All tools MUST include annotations with readOnlyHint/destructiveHint
 * per Anthropic's Connectors Directory requirements. Missing annotations = rejection.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Standard annotations for read-only tools (all Pyth tools are read-only)
 */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
} as const;

/**
 * All available tools for the Pyth MCP Server
 */
export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'get_price_feeds',
    description:
      'Search and list available Pyth Network price feeds. Filter by symbol query (e.g., "BTC", "ETH") or asset type (crypto, equity, fx, metal, rates). Returns feed IDs and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to filter by symbol (e.g., "BTC", "SOL", "AAPL")',
        },
        asset_type: {
          type: 'string',
          enum: ['crypto', 'equity', 'fx', 'metal', 'rates'],
          description: 'Filter by asset category',
        },
      },
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_latest_price',
    description:
      'Get real-time price data for one or more Pyth price feeds. Returns current price, confidence interval, and EMA price. Price = value * 10^expo.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of price feed IDs (hex format, 0x-prefixed)',
          minItems: 1,
          maxItems: 100,
        },
      },
      required: ['feed_ids'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_price_at_timestamp',
    description:
      'Get historical price data at a specific point in time. Useful for backtesting, settlement, and historical analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of price feed IDs',
          minItems: 1,
          maxItems: 100,
        },
        timestamp: {
          type: 'integer',
          description: 'Unix timestamp (seconds since epoch)',
        },
      },
      required: ['feed_ids', 'timestamp'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_ema_price',
    description:
      'Get Exponential Moving Average (EMA) price for feeds. EMA provides smoothed prices that reduce noise and manipulation risk. Returns both current price and EMA price for comparison.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of price feed IDs',
          minItems: 1,
          maxItems: 100,
        },
      },
      required: ['feed_ids'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_twap',
    description:
      'Get Time-Weighted Average Price (TWAP) for price feeds. TWAP reduces manipulation risk by averaging prices over a time window (1-600 seconds). Essential for DeFi applications like liquidations and settlements.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of price feed IDs (hex format, 0x-prefixed)',
          minItems: 1,
          maxItems: 100,
        },
        window_seconds: {
          type: 'integer',
          minimum: 1,
          maximum: 600,
          default: 60,
          description: 'TWAP calculation window in seconds (1-600)',
        },
      },
      required: ['feed_ids'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_publisher_caps',
    description:
      'Get publisher staking information and caps. Shows network health and publisher participation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_price_feed_info',
    description:
      'Get detailed metadata for a specific price feed including base/quote currencies, asset type, and symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_id: {
          type: 'string',
          description: 'Price feed ID (hex format, 0x-prefixed)',
        },
      },
      required: ['feed_id'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_historical_prices',
    description:
      'Get historical price data over a time range with specified intervals. From Benchmarks API.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of price feed IDs',
          minItems: 1,
          maxItems: 10,
        },
        start_timestamp: {
          type: 'integer',
          description: 'Start Unix timestamp',
        },
        interval_seconds: {
          type: 'integer',
          description: 'Interval between data points in seconds',
          minimum: 1,
        },
      },
      required: ['feed_ids', 'start_timestamp', 'interval_seconds'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_ohlcv',
    description:
      'Get OHLCV (candlestick) data for charting. TradingView-compatible format with open, high, low, close prices.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name (e.g., "Crypto.BTC/USD")',
        },
        resolution: {
          type: 'string',
          enum: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          description: 'Candle resolution (1/5/15/30/60/240 minutes, D/W/M for day/week/month)',
        },
        from: {
          type: 'integer',
          description: 'Start Unix timestamp',
        },
        to: {
          type: 'integer',
          description: 'End Unix timestamp',
        },
      },
      required: ['symbol', 'resolution', 'from', 'to'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'search_symbols',
    description: 'Search for price feed symbols by name or ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        type: {
          type: 'string',
          description: 'Filter by asset type',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 30,
          description: 'Maximum results to return',
        },
      },
      required: ['query'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },

  {
    name: 'get_popular_feeds',
    description:
      'Get a curated list of popular price feed IDs for common assets (BTC, ETH, SOL, stablecoins, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['crypto', 'stablecoins', 'equities', 'fx', 'metals', 'all'],
          default: 'all',
          description: 'Category of feeds to return',
        },
      },
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
];

/**
 * Get tool by name
 */
export function getToolDefinition(name: string): Tool | undefined {
  return TOOL_DEFINITIONS.find(tool => tool.name === name);
}
