/**
 * MCP Resource Definitions for Pyth Network
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';

/**
 * Available resources
 */
export const RESOURCE_DEFINITIONS: Resource[] = [
  {
    uri: 'pyth://network/status',
    name: 'Network Status',
    description: 'Pyth Network health, statistics, and supported chains',
    mimeType: 'application/json',
  },
  {
    uri: 'pyth://feeds/catalog',
    name: 'Price Feed Catalog',
    description: 'Complete catalog of available Pyth price feeds',
    mimeType: 'application/json',
  },
  {
    uri: 'pyth://feeds/popular',
    name: 'Popular Feeds',
    description: 'Commonly used price feed IDs (BTC, ETH, SOL, stablecoins, etc.)',
    mimeType: 'application/json',
  },
  {
    uri: 'pyth://docs/api',
    name: 'API Reference',
    description: 'Quick reference for Hermes and Benchmarks API endpoints',
    mimeType: 'text/markdown',
  },
  {
    uri: 'pyth://docs/integration',
    name: 'Integration Guide',
    description: 'Best practices for integrating Pyth price feeds',
    mimeType: 'text/markdown',
  },
];

/**
 * Get resource by URI
 */
export function getResourceDefinition(uri: string): Resource | undefined {
  return RESOURCE_DEFINITIONS.find(resource => resource.uri === uri);
}
