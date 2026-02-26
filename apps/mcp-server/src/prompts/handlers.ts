/**
 * MCP Prompt Handlers for Pyth Network
 */

import type { GetPromptResult, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Handle prompt requests
 */
export function handleGetPrompt(
  name: string,
  args?: Record<string, string>
): GetPromptResult {
  switch (name) {
    case 'analyze_price_feed':
      return getAnalyzePriceFeedPrompt(args?.['symbol'] ?? 'BTC');

    case 'compare_assets':
      return getCompareAssetsPrompt(args?.['symbols'] ?? 'BTC,ETH,SOL');

    case 'market_overview':
      return getMarketOverviewPrompt(args?.['category'] ?? 'crypto');

    case 'volatility_report':
      return getVolatilityReportPrompt(
        args?.['symbol'] ?? 'BTC',
        args?.['window'] ? parseInt(args['window'], 10) : 300
      );

    case 'price_deviation_check':
      return getPriceDeviationCheckPrompt(args?.['base_asset'] ?? 'BTC');

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// ============================================================================
// Prompt Templates
// ============================================================================

function getAnalyzePriceFeedPrompt(symbol: string): GetPromptResult {
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Analyze the ${symbol} price feed from Pyth Network. Follow these steps:

1. **Find the Feed**
   Use \`get_price_feeds\` with query "${symbol}" to find the correct feed ID.

2. **Get Current Price**
   Use \`get_latest_price\` with the feed ID to get:
   - Current spot price
   - Confidence interval (uncertainty)
   - EMA price (exponential moving average)
   - Publish timestamp

3. **Calculate TWAP**
   Use \`get_twap\` with a 5-minute (300 second) window to get the time-weighted average.

4. **Analysis**
   Compare the spot price vs TWAP:
   - If spot > TWAP: Short-term bullish momentum
   - If spot < TWAP: Short-term bearish momentum

   Evaluate confidence interval:
   - < 0.1%: Very tight, high certainty
   - 0.1-0.5%: Normal volatility
   - > 0.5%: Elevated uncertainty, possibly thin liquidity

5. **Summary**
   Provide a concise summary with:
   - Current price and 24h context if available
   - Momentum signal (bullish/bearish/neutral)
   - Volatility assessment
   - Any notable observations`,
      },
    },
  ];

  return {
    description: `Comprehensive analysis of ${symbol} price feed`,
    messages,
  };
}

function getCompareAssetsPrompt(symbolsStr: string): GetPromptResult {
  const symbols = symbolsStr.split(',').map(s => s.trim());

  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Compare the following assets: ${symbols.join(', ')}

1. **Get Feed IDs**
   Use \`get_price_feeds\` to find feed IDs for each asset.

2. **Fetch Current Prices**
   Use \`get_latest_price\` with all feed IDs in a single call.

3. **Get TWAPs**
   Use \`get_twap\` with a 60-second window for all assets.

4. **Build Comparison Table**
   Create a table with columns:
   | Asset | Price | Confidence | TWAP | Momentum |

5. **Relative Analysis**
   - Which asset has the tightest confidence (most liquid)?
   - Which shows strongest bullish/bearish momentum?
   - Any divergences worth noting?

6. **Summary**
   Rank the assets by:
   - Price stability (confidence)
   - Short-term momentum (price vs TWAP)
   - Overall market conditions`,
      },
    },
  ];

  return {
    description: `Side-by-side comparison of ${symbols.join(', ')}`,
    messages,
  };
}

function getMarketOverviewPrompt(category: string): GetPromptResult {
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Generate a market overview report for the ${category} category.

1. **Get Category Feeds**
   Use \`get_price_feeds\` with asset_type="${category}" to list available feeds.

2. **Select Top Assets**
   Identify the most important assets in this category (top 5-10 by relevance).

3. **Fetch Prices**
   Use \`get_latest_price\` for the selected assets.

4. **Calculate TWAPs**
   Use \`get_twap\` with 300-second window for trend analysis.

5. **Market Report Structure**

   ## ${category.toUpperCase()} Market Overview
   *Generated: [timestamp]*

   ### Key Metrics
   - Total feeds available: X
   - Assets analyzed: Y

   ### Top Performers
   [List assets with strongest bullish momentum]

   ### Underperformers
   [List assets with bearish signals]

   ### Volatility Watch
   [Assets with unusually wide confidence intervals]

   ### Market Sentiment
   Overall ${category} market appears [bullish/bearish/mixed] based on:
   - X of Y assets showing positive momentum
   - Average confidence interval: Z%

   ### Notable Observations
   [Any interesting patterns or divergences]`,
      },
    },
  ];

  return {
    description: `Market overview for ${category} assets`,
    messages,
  };
}

function getVolatilityReportPrompt(symbol: string, windowSeconds: number): GetPromptResult {
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Analyze volatility for ${symbol} using Pyth Network data.

1. **Get Feed ID**
   Use \`get_price_feeds\` with query="${symbol}".

2. **Current Price Data**
   Use \`get_latest_price\` to get:
   - Spot price
   - Confidence interval
   - EMA price

3. **Multiple TWAP Windows**
   Calculate TWAPs at different windows:
   - 60 seconds (short-term)
   - ${windowSeconds} seconds (primary)
   - 600 seconds (maximum, if different from primary)

4. **Volatility Metrics**

   ## Volatility Report: ${symbol}

   ### Confidence Analysis
   - Current confidence: $X (Y%)
   - Interpretation: [low/normal/high volatility]

   ### TWAP Divergence
   | Window | TWAP | Spot Diff | Signal |
   |--------|------|-----------|--------|
   | 60s    | $X   | +/-Y%     | ...    |
   | ${windowSeconds}s  | $X   | +/-Y%     | ...    |

   ### Price Stability
   - EMA vs Spot: [divergence analysis]
   - Short-term trend: [accelerating/decelerating/stable]

   ### Risk Assessment
   Based on current volatility metrics:
   - Recommended position sizing: [conservative/normal/aggressive]
   - Stop-loss buffer suggestion: X%
   - Key price levels to watch: $X, $Y

5. **Summary**
   One-paragraph volatility summary with actionable insights.`,
      },
    },
  ];

  return {
    description: `Volatility analysis for ${symbol}`,
    messages,
  };
}

function getPriceDeviationCheckPrompt(baseAsset: string): GetPromptResult {
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Check for price deviations between ${baseAsset} pairs to detect stablecoin depegs or feed anomalies.

1. **Find Related Feeds**
   Use \`get_price_feeds\` with query="${baseAsset}" to find all related feeds:
   - ${baseAsset}/USD (primary reference)
   - ${baseAsset}/USDC (if available)
   - ${baseAsset}/USDT (if available)

2. **Get All Prices**
   Use \`get_latest_price\` for all found feeds.

3. **Get Stablecoin Reference Prices**
   Fetch USDC/USD and USDT/USD to check for depegs:
   - USDC/USD should be ~1.00
   - USDT/USD should be ~1.00

4. **Calculate Implied Prices**
   For each stablecoin pair, calculate the USD-equivalent:
   - ${baseAsset}/USDC * USDC/USD = implied ${baseAsset}/USD
   - ${baseAsset}/USDT * USDT/USD = implied ${baseAsset}/USD

5. **Deviation Analysis**

   ## Price Deviation Check: ${baseAsset}

   ### Stablecoin Health
   | Stablecoin | Price vs USD | Status |
   |------------|--------------|--------|
   | USDC | $X | [Healthy/Depegged] |
   | USDT | $X | [Healthy/Depegged] |

   ### ${baseAsset} Price Consistency
   | Pair | Raw Price | USD Equivalent | Deviation |
   |------|-----------|----------------|-----------|
   | ${baseAsset}/USD  | $X | $X (reference) | 0% |
   | ${baseAsset}/USDC | X  | $Y | +/-Z% |
   | ${baseAsset}/USDT | X  | $Y | +/-Z% |

   ### Confidence Check
   [Verify all prices have acceptable confidence intervals]

   ### Anomaly Detection
   - Deviations > 0.5% may indicate stablecoin depeg
   - Deviations > 1% warrant investigation
   - Check if anomaly is in stablecoin or ${baseAsset} feed

6. **Summary**
   - Are all ${baseAsset} prices consistent across quote currencies?
   - Any stablecoin depeg signals?
   - Feed health assessment`,
      },
    },
  ];

  return {
    description: `Price deviation check for ${baseAsset} across USD/stablecoin pairs`,
    messages,
  };
}
