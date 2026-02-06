/**
 * MCP Prompt Definitions for Pyth Network
 */

import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Available prompts
 */
export const PROMPT_DEFINITIONS: Prompt[] = [
  {
    name: 'analyze_price_feed',
    description:
      'Deep analysis of a price feed including current price, TWAP, confidence, and volatility assessment',
    arguments: [
      {
        name: 'symbol',
        description: 'Asset symbol to analyze (e.g., "BTC", "ETH", "SOL")',
        required: true,
      },
    ],
  },
  {
    name: 'compare_assets',
    description: 'Side-by-side comparison of multiple assets with relative performance metrics',
    arguments: [
      {
        name: 'symbols',
        description: 'Comma-separated list of symbols (e.g., "BTC,ETH,SOL")',
        required: true,
      },
    ],
  },
  {
    name: 'market_overview',
    description: 'Comprehensive market report for an asset category',
    arguments: [
      {
        name: 'category',
        description: 'Asset category: crypto, equity, fx, metal, or rates',
        required: true,
      },
    ],
  },
  {
    name: 'volatility_report',
    description: 'Analyze price volatility using confidence intervals and TWAP divergence',
    arguments: [
      {
        name: 'symbol',
        description: 'Asset symbol to analyze',
        required: true,
      },
      {
        name: 'window',
        description: 'TWAP window in seconds (default: 300)',
        required: false,
      },
    ],
  },
  {
    name: 'price_deviation_check',
    description:
      'Check for price deviations between USD and stablecoin pairs (e.g., BTC/USD vs BTC/USDC). Useful for detecting stablecoin depegs or feed anomalies.',
    arguments: [
      {
        name: 'base_asset',
        description: 'Base asset to check (e.g., "BTC", "ETH")',
        required: true,
      },
    ],
  },
];

/**
 * Get prompt by name
 */
export function getPromptDefinition(name: string): Prompt | undefined {
  return PROMPT_DEFINITIONS.find(prompt => prompt.name === name);
}
