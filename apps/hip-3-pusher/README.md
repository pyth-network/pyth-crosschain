# HIP-3 Pusher

`hip-3-pusher` is an oracle updater for [HIP-3 markets](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals) on Hyperliquid.

**Features:**
- Aggregates prices from multiple sources: Pyth Lazer, Pythnet/Hermes, SEDA, and Hyperliquid
- Waterfall price resolution with automatic failover
- AWS KMS and multisig signing support
- Prometheus metrics for observability

## Architecture

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Lazer     │ │   Hermes    │ │    SEDA     │ │ Hyperliquid │
│  WebSocket  │ │  WebSocket  │ │   HTTP      │ │  WebSocket  │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │               │
       └───────────────┴───────┬───────┴───────────────┘
                               │
                        ┌──────▼──────┐
                        │ PriceState  │  Maintains latest prices
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  Publisher  │  Calls setOracle API
                        └─────────────┘
```

The pusher runs multiple listeners that subscribe to price feeds and store updates in `PriceState`. The `Publisher` runs on a configurable interval, queries `PriceState` for the latest prices using waterfall logic, and publishes to Hyperliquid's `setOracle` API.

## Prerequisites

### Required Software
- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- Docker (optional)

### Required Accounts & Keys
- **Hyperliquid Account**: Ethereum private key for the oracle pusher (deployer or sub-deployer)
- **Pyth Lazer API Key**: Contact Pyth team
- **SEDA API Key** (optional): If using SEDA feeds
- **AWS KMS** (optional): For secure key management

## Quick Start

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

cd apps/hip-3-pusher

# Copy sample config
cp config/config.pyth.testnet.toml config/config.toml

# Edit config.toml with your settings (see Configuration Guide below)

# Install dependencies
uv sync

# Run (dry-run mode - set enable_publish = false first)
uv run -m pusher.main -c config/config.toml

# Run with debug logging
LOG_LEVEL=DEBUG uv run -m pusher.main -c config/config.toml
```

### Docker

```bash
cd apps/hip-3-pusher

docker build -f Dockerfile -t hip-3-pusher .

docker run --rm \
  -p 9090:9090 \
  -v "$(pwd)/config/config.toml:/app/config/config.toml" \
  -v "/path/to/private-key.txt:/private-key.txt" \
  hip-3-pusher
```
### Running Tests

```bash
uv sync --dev
uv run pytest

# With verbose output
uv run pytest -v
```

### Type Checking

```bash
cd apps/hip-3-pusher
uv sync --dev
uv run mypy src/
```

### Formatting & Linting

This project uses [Ruff](https://docs.astral.sh/ruff/) for formatting and linting.

```bash
cd apps/hip-3-pusher
uv sync --dev

# Check formatting (no changes)
uv run ruff format --check src/ tests/

# Auto-format code
uv run ruff format src/ tests/

# Run linter
uv run ruff check src/ tests/

# Run linter with auto-fix
uv run ruff check --fix src/ tests/
```



---

# Configuration Guide

This section explains how to configure the pusher, including the business logic behind each setting.

## How Price Resolution Works (Waterfall Logic)

The core concept is the **waterfall**: for each symbol, you configure a prioritized list of price sources. The pusher tries each source in order until it finds a **valid** (non-stale) price.

```
BTC Oracle Waterfall Example:
  1. Try hl_oracle BTC      → if fresh, use it ✓
  2. Try lazer BTC/USDT     → if fresh, use it ✓
  3. Try hermes BTC/USDT    → if fresh, use it ✓
  4. All failed             → no price published this cycle
```

A price is considered **stale** if its timestamp is older than `stale_price_threshold_seconds`. This ensures you never publish outdated prices even if a data source goes down.

## Price Types

Hyperliquid's `setOracle` API accepts three price types:

| Type | Purpose | Required |
|------|---------|----------|
| `oracle` | Primary price for liquidations, PnL | Yes |
| `mark` | Funding rate calculations | No (up to 2 values) |
| `external` | Reference price for monitoring | No |

## Global Settings

```toml
# Staleness threshold - prices older than this are rejected
# Lower = more reliable but more fallbacks during network issues
# Recommendation: 3-5 seconds for production
stale_price_threshold_seconds = 5

# Prometheus metrics endpoint port
prometheus_port = 9090
```

## Hyperliquid Settings

```toml
[hyperliquid]
# WebSocket URLs for market data (oracle, mark, mid prices)
# Multiple URLs = redundancy, pusher subscribes to all
# Mainnet: wss://api.hyperliquid.xyz/ws
# Testnet: wss://api.hyperliquid-testnet.xyz/ws
hyperliquid_ws_urls = ["wss://api.hyperliquid-testnet.xyz/ws"]

# Your HIP-3 market name (must match deployed market)
market_name = "pyth"

# Symbols to subscribe to for reference prices
# Format: "SYMBOL" for main HL markets, "market:SYMBOL" for HIP-3
# These feed hl_oracle, hl_mark, and hl_mid sources
asset_context_symbols = ["BTC", "pyth:BTC", "pyth:PYTH"]

# Network selection
use_testnet = true

# Private key file (hex string, no 0x prefix)
# SECURITY: chmod 600 this file
oracle_pusher_key_path = "private-key.txt"

# Publishing interval (seconds)
# HL rate limit is 2.5s - setting lower causes handled rate limit errors
publish_interval = 3.0

# HTTP timeout for publish requests
publish_timeout = 5.0

# Master switch - set false for dry-run testing
enable_publish = true
```

### Optional Hyperliquid Settings

```toml
[hyperliquid]
# Override publish API URLs (defaults based on use_testnet)
push_urls = ["https://api.hyperliquid-testnet.xyz"]

# Duplicate oracle as mark price (legacy option)
duplicate_mark_price = false

# userRateLimit API query interval for metrics (default: 1800)
user_limit_interval = 1800

# WebSocket ping interval (default: 20)
ws_ping_interval = 20

# Reconnection attempts before exit (default: 20)
stop_after_attempt = 20
```

## Signing Options

### Local Key (Default)
```toml
[kms]
enable_kms = false

[multisig]
enable_multisig = false
```

### AWS KMS
```toml
[kms]
enable_kms = true
aws_kms_key_id_path = "kms-key-id.txt"
```

### Multisig
```toml
[multisig]
enable_multisig = true
multisig_address = "0x..."
```

> **Note:** KMS + multisig combination is not yet supported.

## Data Sources

### Pyth Lazer

Ultra-low-latency price feeds via WebSocket.

```toml
[lazer]
# Multiple URLs for redundancy
lazer_urls = [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
]

# API key (Bearer token)
lazer_api_key = "<your-key>"

# Lazer feed IDs (numeric, NOT Pythnet hex IDs)
# Common: 1=BTC, 3=PYTH, 8=USDT
feed_ids = [1, 3, 8]
```

### Pythnet/Hermes

Traditional Pyth price feeds (slower than Lazer, battle-tested).

```toml
[hermes]
hermes_urls = ["wss://hermes.pyth.network/ws"]

# Pythnet feed IDs (64-char hex, no 0x prefix)
# Find IDs: https://pyth.network/developers/price-feed-ids
feed_ids = [
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", # BTC
    "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff", # PYTH
    "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", # USDT
]
```

### SEDA

Custom oracle feeds via HTTP polling (for specialized feeds not in Pyth).

```toml
[seda]
url = "https://fast-api.testnet.seda.xyz/execute"
api_key_path = "seda-api-key.txt"  # optional
poll_interval = 2
poll_failure_interval = 1  # faster retry on failure
poll_timeout = 3

# Per-feed configuration (optional)
[seda.feeds.GOLD]
exec_program_id = "abc123..."
exec_inputs = '{"symbol": "GOLD"}'

# Response field mapping (defaults shown)
# price_field = "price"
# timestamp_field = "timestamp"
# session_flag_field = "session_flag"
# last_price_field = "last_price"
# session_mark_px_ema_field = "mark_px_ema"
```

---

## Price Source Configuration

This is the heart of the config - defining how prices are computed for each symbol.

### Source Types

#### 1. `single` - Direct Source

Use one source directly without transformation.

```toml
{ source_type = "single", source = { source_name = "hl_oracle", source_id = "BTC" } }
```

#### 2. `pair` - Base/Quote Ratio

Compute `base_price / quote_price`. Common for getting USD prices via USDT.

```toml
{ source_type = "pair",
  base_source = { source_name = "lazer", source_id = 1, exponent = -8 },
  quote_source = { source_name = "lazer", source_id = 8, exponent = -8 } }
```

#### 3. `constant` - Fixed Value

Returns a hardcoded price. **Use sparingly** - only for testing or known fixed-price assets.

```toml
{ source_type = "constant", value = "0.0100" }
```

#### 4. `oracle_mid_average` - Blended Price

Computes `(oracle_price + mid_price) / 2`. Creates a mark price responsive to trading activity while anchored to oracle.

```toml
{ source_type = "oracle_mid_average", symbol = "pyth:BTC" }
```

#### 5. `session_ema` - Session-Aware (Advanced)

For assets with trading sessions (e.g., equity indices). Returns different values based on market hours:

- **During market hours**: `[oracle_price, ema_price]`
- **Off hours** (`session_flag=true`): `[oracle_price, oracle_price]`

```toml
{ source_type = "session_ema",
  oracle_source = { source_name = "seda", source_id = "SPX", use_session_flag = true },
  ema_source = { source_name = "seda_ema", source_id = "SPX" } }
```

**Why two prices?** Hyperliquid calculates mark price as:
```
new_mark = median(markPxs[0], markPxs[1], local_mark)
```
where `local_mark = median(best_bid, best_ask, last_trade)`.

- **Off hours**: Sending `[oracle, oracle]` forces the median to equal oracle (oracle appears twice, guaranteeing it's the median regardless of local_mark).
- **Market hours**: Sending `[oracle, ema]` lets the median be influenced by all three values, allowing more market-responsive behavior.

### Available Source Names

| source_name | Description | source_id Format |
|-------------|-------------|------------------|
| `hl_oracle` | Hyperliquid oraclePx | Symbol string (`"BTC"`) |
| `hl_mark` | Hyperliquid markPx | Symbol string |
| `hl_mid` | Hyperliquid mid price | Symbol string |
| `lazer` | Pyth Lazer feed | Numeric ID (`1`) |
| `hermes` | Pythnet/Hermes feed | 64-char hex string |
| `seda` | SEDA oracle price | Feed name string |
| `seda_last` | SEDA last price | Feed name string |
| `seda_ema` | SEDA EMA price | Feed name string |

### Exponent Handling

Lazer and Hermes return prices as integers with an exponent:

```
actual_price = raw_price × 10^exponent
```

Example: `raw=6500000000000`, `exponent=-8` → `65000.00`

Set `exponent` in your config to match the feed's native format (typically `-8` for Pyth feeds).

---

## Example Configurations

### Basic BTC Oracle with Waterfall

```toml
[price.oracle]
BTC = [
    # Priority 1: HL's own oracle (consistency with main market)
    { source_type = "single", source = { source_name = "hl_oracle", source_id = "BTC" } },
    
    # Priority 2: Lazer BTC/USDT
    { source_type = "pair",
      base_source = { source_name = "lazer", source_id = 1, exponent = -8 },
      quote_source = { source_name = "lazer", source_id = 8, exponent = -8 } },
    
    # Priority 3: Hermes fallback
    { source_type = "pair",
      base_source = { source_name = "hermes", source_id = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", exponent = -8 },
      quote_source = { source_name = "hermes", source_id = "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", exponent = -8 } },
]
```

### New Token (Pyth-only Sources)

```toml
[price.oracle]
NEWTOKEN = [
    { source_type = "pair",
      base_source = { source_name = "lazer", source_id = 42, exponent = -8 },
      quote_source = { source_name = "lazer", source_id = 8, exponent = -8 } },
    { source_type = "pair",
      base_source = { source_name = "hermes", source_id = "<hex-feed-id>", exponent = -8 },
      quote_source = { source_name = "hermes", source_id = "<usdt-hex-feed-id>", exponent = -8 } },
]
```

### Mark Price with Oracle-Mid Blend

```toml
[price.mark]
BTC = [{ source_type = "oracle_mid_average", symbol = "pyth:BTC" }]
```

### External Reference Price

```toml
[price.external]
BTC = [{ source_type = "single", source = { source_name = "hl_mark", source_id = "BTC" } }]

# For tokens without HL reference, use constant placeholder
NEWTOKEN = [{ source_type = "constant", value = "1.00" }]
```

---

## Troubleshooting

### "No valid oracle prices available"

All sources in the waterfall are stale or unavailable.

- Check `stale_price_threshold_seconds` isn't too aggressive
- Verify WebSocket connections in logs
- Ensure `feed_ids` are correct

### "Oracle price update too often" (rate limit)

`publish_interval` is below HL's 2.5s limit.

- This is handled gracefully, but increase interval to reduce log noise

### "Invalid perp DEX"

- `market_name` doesn't match your deployed HIP-3 market
- `use_testnet` doesn't match your target environment

### Prices always falling back to later sources

Primary source is consistently stale.

- Check listener connection logs
- Verify `feed_ids` match your subscribed feeds
- Ensure Lazer API key is valid

### Session-aware prices not working

- Set `use_session_flag = true` on the oracle source
- Verify SEDA feed includes `session_flag_field` in response
- Check `session_flag` value in debug logs

---

## Metrics and dashboards

See the [HIP-3 production relayer dashboard](http://grafana.monster-vibes.ts.net/d/ef54niixonta8c/hip-3-relayer?orgId=1)

The dashboard uses the following Prometheus metrics:
- `hip_3_relayer_last_published_time` - Last successful push timestamp
- `hip_3_relayer_update_attempts_total` - Push attempts by status
- `hip_3_relayer_no_oracle_price_count` - Failed pushes with no valid price
- `hip_3_relayer_push_interval` - Time between pushes
- `hip_3_relayer_user_request_balance` - Remaining rate limit quota
