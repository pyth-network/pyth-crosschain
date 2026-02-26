# Pyth Network API Reference

Comprehensive reference for all Pyth Network APIs relevant to the MCP server implementation.

---

## API Endpoints Overview

| API | Base URL | Purpose |
|-----|----------|---------|
| Hermes | `https://hermes.pyth.network` | Real-time price data |
| Benchmarks | `https://benchmarks.pyth.network` | Historical price data |
| On-Chain | Various contracts | Smart contract integration |

---

## Hermes API (Real-time)

### GET /v2/price_feeds

List all available price feeds with optional filtering.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | No | Filter by symbol (e.g., "BTC", "ETH") |
| `asset_type` | string | No | Filter by type: `crypto`, `equity`, `fx`, `metal`, `rates` |

**Response:**
```json
[
  {
    "id": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    "attributes": {
      "asset_type": "Crypto",
      "base": "BTC",
      "description": "BTC/USD",
      "generic_symbol": "BTCUSD",
      "quote_currency": "USD",
      "symbol": "Crypto.BTC/USD"
    }
  }
]
```

---

### GET /v2/updates/price/latest

Get latest price updates for specified feed IDs.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids[]` | string[] | Yes | Price feed IDs (hex, 0x-prefixed) |
| `encoding` | string | No | `hex` (default) or `base64` |
| `parsed` | boolean | No | Include parsed price data (default: true) |
| `binary` | boolean | No | Include binary update data |

**Response:**
```json
{
  "binary": {
    "encoding": "hex",
    "data": ["..."]
  },
  "parsed": [
    {
      "id": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      "price": {
        "price": "4235678900000",
        "conf": "1234567890",
        "expo": -8,
        "publish_time": 1706123456
      },
      "ema_price": {
        "price": "4234567890000",
        "conf": "987654321",
        "expo": -8,
        "publish_time": 1706123456
      },
      "metadata": {
        "slot": 123456789,
        "proof_available_time": 1706123456,
        "prev_publish_time": 1706123455
      }
    }
  ]
}
```

**Price Calculation:**
```
actual_price = price * 10^expo
confidence = conf * 10^expo
```

Example: `price=4235678900000, expo=-8` means `$42,356.789`

---

### GET /v2/updates/price/{publish_time}

Get price updates at or after a specific timestamp.

**Path Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `publish_time` | integer | Unix timestamp (seconds) |

**Query Parameters:**
Same as `/v2/updates/price/latest`

---

### GET /v2/updates/twap/latest

Get time-weighted average prices.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids[]` | string[] | Yes | Price feed IDs |
| `window_seconds` | integer | No | TWAP window (1-600 seconds, default: 60) |

**Response:**
```json
{
  "parsed": [
    {
      "id": "0xe62df6c8...",
      "twap": {
        "price": "4235000000000",
        "conf": "500000000",
        "expo": -8,
        "publish_time": 1706123456
      },
      "start_time": 1706123396,
      "end_time": 1706123456
    }
  ]
}
```

---

### GET /v2/updates/publisher_stake_caps/latest

Get publisher staking information.

**Response:**
```json
{
  "binary": {
    "encoding": "hex",
    "data": ["..."]
  },
  "parsed": {
    "publisher_stake_caps": [
      {
        "publisher": "0x...",
        "cap": "1000000000000"
      }
    ]
  }
}
```

---

### GET /v2/updates/price/stream (SSE)

Stream real-time price updates via Server-Sent Events.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids[]` | string[] | Yes | Price feed IDs to subscribe |
| `encoding` | string | No | `hex` or `base64` |
| `parsed` | boolean | No | Include parsed data |
| `allow_unordered` | boolean | No | Allow out-of-order updates |
| `benchmarks_only` | boolean | No | Only benchmark prices |

**Event Format:**
```
data: {"type":"price_update","price_feed":{"id":"0x...","price":{...}}}
```

---

## Benchmarks API (Historical)

### GET /v1/price_feeds/

List available price feeds with metadata.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | No | Search by symbol |
| `asset_type` | string | No | Filter by asset type |

---

### GET /v1/price_feeds/{id}

Get detailed metadata for a specific feed.

**Path Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Price feed ID (hex) |

---

### GET /v1/updates/price/{timestamp}

Get historical price at a specific timestamp.

**Path Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `timestamp` | integer | Unix timestamp |

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids` | string[] | Yes | Price feed IDs |
| `encoding` | string | No | `hex` or `base64` |
| `parsed` | boolean | No | Include parsed data |

---

### GET /v1/updates/price/{timestamp}/{interval}

Get historical prices over a time range.

**Path Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `timestamp` | integer | Start timestamp |
| `interval` | integer | Interval in seconds |

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids` | string[] | Yes | Price feed IDs |
| `unique` | boolean | No | Only unique prices |

---

### TradingView Shim Endpoints

For integration with TradingView charting:

| Endpoint | Purpose |
|----------|---------|
| `/v1/shims/tradingview/config` | TradingView configuration |
| `/v1/shims/tradingview/symbol_info` | Symbol metadata |
| `/v1/shims/tradingview/symbols` | Symbol lookup |
| `/v1/shims/tradingview/search` | Symbol search |
| `/v1/shims/tradingview/history` | OHLCV data |

**GET /v1/shims/tradingview/history**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | Yes | Feed symbol |
| `resolution` | string | Yes | Candle size (1, 5, 15, 60, D, W) |
| `from` | integer | Yes | Start timestamp |
| `to` | integer | Yes | End timestamp |

---

## Price Feed IDs (Popular)

### Crypto

| Asset | Feed ID |
|-------|---------|
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| SOL/USD | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| PYTH/USD | `0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff` |
| BONK/USD | `0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419` |

### Stablecoins

| Asset | Feed ID |
|-------|---------|
| USDC/USD | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |
| USDT/USD | `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b` |
| DAI/USD | `0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd` |

### Equities

| Asset | Feed ID |
|-------|---------|
| AAPL/USD | `0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688` |
| TSLA/USD | `0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1` |
| MSFT/USD | `0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1` |

### FX

| Asset | Feed ID |
|-------|---------|
| EUR/USD | `0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b` |
| GBP/USD | `0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1` |

### Metals

| Asset | Feed ID |
|-------|---------|
| XAU/USD | `0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2` |
| XAG/USD | `0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e` |

---

## Rate Limits

The Pyth APIs are generally permissive but best practices:

- Batch requests where possible (up to 100 feed IDs)
- Use streaming for real-time updates instead of polling
- Cache static data (feed metadata)
- Implement exponential backoff on errors

---

## Error Responses

Standard error format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Price feed not found"
  }
}
```

Common error codes:
- `INVALID_ARGUMENT` - Bad parameter
- `NOT_FOUND` - Feed doesn't exist
- `INTERNAL` - Server error
- `UNAVAILABLE` - Service temporarily down

---

## Best Practices

1. **Use Universal IDs** - Feed IDs work across all chains
2. **Check Confidence** - High confidence = low volatility
3. **Respect Publish Time** - Don't use stale prices
4. **Handle Exponents** - Always apply `expo` to get real values
5. **Use TWAP for Trading** - Reduces manipulation risk
6. **Stream Don't Poll** - SSE is more efficient
