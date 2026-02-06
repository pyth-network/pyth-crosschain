# Pyth MCP Server - Usage Examples

These examples demonstrate core functionality of the Pyth MCP Server with Claude.

---

## Example 1: Get Current Bitcoin Price

**User prompt:**
> What's the current price of Bitcoin according to Pyth?

**Claude's workflow:**
1. Uses `get_price_feeds` to find BTC/USD feed ID
2. Uses `get_latest_price` to fetch current price with confidence interval

**Expected response:**
```
Bitcoin (BTC/USD) is currently trading at $43,256.78 according to Pyth Network.

- Price: $43,256.78
- Confidence: ±$12.50 (0.03%)
- EMA Price: $43,198.45
- Last updated: 2 seconds ago

The tight confidence interval (0.03%) indicates high certainty in this price
with strong liquidity across data providers.
```

---

## Example 2: Compare Multiple Crypto Assets

**User prompt:**
> Compare the current prices and volatility of BTC, ETH, and SOL

**Claude's workflow:**
1. Uses `get_price_feeds` to find feed IDs for all three assets
2. Uses `get_latest_price` with all feed IDs in a single request
3. Uses `get_twap` with 300-second window for trend analysis
4. Compares spot price vs TWAP to determine momentum

**Expected response:**
```
## Crypto Comparison (Pyth Network Data)

| Asset | Price | Confidence | TWAP (5min) | Momentum |
|-------|-------|------------|-------------|----------|
| BTC | $43,256.78 | 0.03% | $43,198.45 | +0.13% ↑ |
| ETH | $2,284.32 | 0.05% | $2,279.18 | +0.23% ↑ |
| SOL | $98.45 | 0.12% | $97.82 | +0.64% ↑ |

**Analysis:**
- All three assets showing short-term bullish momentum (price > TWAP)
- SOL has the strongest momentum (+0.64%) but also wider confidence interval
- BTC has the tightest confidence (most liquid/reliable price)
- ETH showing moderate momentum with good price certainty
```

---

## Example 3: Historical Price Analysis

**User prompt:**
> Get me the OHLCV data for ETH over the past 24 hours with hourly candles

**Claude's workflow:**
1. Uses `get_ohlcv` with symbol "Crypto.ETH/USD", resolution "60", and appropriate timestamps

**Expected response:**
```
## ETH/USD - 24 Hour OHLCV (Hourly Candles)

Retrieved 24 candles from Pyth Benchmarks API.

| Time (UTC) | Open | High | Low | Close |
|------------|------|------|-----|-------|
| 00:00 | $2,245.20 | $2,258.90 | $2,241.15 | $2,252.30 |
| 01:00 | $2,252.30 | $2,261.45 | $2,248.80 | $2,259.10 |
| ... | ... | ... | ... | ... |
| 23:00 | $2,278.50 | $2,289.20 | $2,275.30 | $2,284.32 |

**24h Summary:**
- Open: $2,245.20
- High: $2,312.45 (at 14:00 UTC)
- Low: $2,238.90 (at 03:00 UTC)
- Close: $2,284.32
- Change: +$39.12 (+1.74%)
```

---

## Example 4: Stablecoin Health Check

**User prompt:**
> Check if USDC and USDT are maintaining their pegs

**Claude's workflow:**
1. Uses `get_latest_price` for USDC/USD and USDT/USD feeds
2. Analyzes deviation from $1.00 peg
3. Checks confidence intervals for any anomalies

**Expected response:**
```
## Stablecoin Peg Status (Pyth Network)

| Stablecoin | Price | Deviation | Confidence | Status |
|------------|-------|-----------|------------|--------|
| USDC | $0.9998 | -0.02% | 0.01% | ✅ Healthy |
| USDT | $1.0001 | +0.01% | 0.01% | ✅ Healthy |

Both major stablecoins are maintaining their pegs within normal bounds
(±0.1% deviation is typical). Tight confidence intervals indicate
reliable price data from multiple sources.

No depeg warnings at this time.
```

---

## Example 5: TWAP for DeFi Integration

**User prompt:**
> I need a 5-minute TWAP for SOL to use in a liquidation calculation

**Claude's workflow:**
1. Uses `get_price_feeds` to get SOL/USD feed ID
2. Uses `get_twap` with 300-second window

**Expected response:**
```
## SOL/USD TWAP (5-minute window)

- **TWAP Price:** $97.82
- **TWAP Confidence:** ±$0.15 (0.15%)
- **Window:** 300 seconds
- **Start time:** 2024-01-15T10:55:00Z
- **End time:** 2024-01-15T11:00:00Z

**For liquidation calculations:**
- Conservative (collateral): Use TWAP - confidence = $97.67
- Aggressive (debt): Use TWAP + confidence = $97.97

Using TWAP instead of spot price reduces manipulation risk for your
liquidation threshold calculations.
```

---

## Example 6: Market Overview by Category

**User prompt:**
> Give me an overview of the metals market from Pyth

**Claude's workflow:**
1. Uses `get_price_feeds` with asset_type="metal"
2. Uses `get_latest_price` for top metal feeds
3. Uses `get_twap` for momentum analysis

**Expected response:**
```
## Metals Market Overview (Pyth Network)

### Precious Metals
| Metal | Price | 24h Trend | Confidence |
|-------|-------|-----------|------------|
| Gold (XAU) | $2,028.45/oz | +0.3% ↑ | 0.02% |
| Silver (XAG) | $22.84/oz | +0.8% ↑ | 0.05% |
| Platinum (XPT) | $897.20/oz | -0.2% ↓ | 0.08% |
| Palladium (XPD) | $965.50/oz | +0.1% ↑ | 0.12% |

**Market Sentiment:** Mildly bullish
- 3 of 4 precious metals showing positive momentum
- Gold and silver leading with tight confidence intervals
- Palladium showing wider spread (lower liquidity)

*Data from 120+ first-party publishers via Pyth Network*
```

---

## Notes

- All examples use the public Hermes API (https://hermes.pyth.network)
- No authentication required for basic usage
- Price data updates approximately every 400ms
- Confidence intervals represent aggregated uncertainty across all data providers
