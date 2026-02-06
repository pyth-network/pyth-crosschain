# Pyth Network MCP Server

**Official Model Context Protocol (MCP) server for Pyth Network oracle data.**

An enterprise-grade TypeScript implementation providing Claude and other AI systems with direct access to Pyth Network's decentralized oracle infrastructure.

---

## Overview

This MCP server enables AI agents to interact with Pyth Network's real-time price feeds, historical data, and network information through a standardized protocol. Built for production use with comprehensive error handling, type safety, and performance optimization.

### What is Pyth Network?

Pyth Network is a decentralized oracle protocol delivering real-time market data to smart contracts across 107+ blockchains. Backed by 125+ first-party data providers (exchanges, market makers, trading firms), Pyth offers:

- **1,930+ price feeds** across crypto, equities, FX, commodities, and rates
- **~400ms update frequency** with sub-second latency
- **Universal price feed IDs** that work across all supported chains
- **Confidence intervals** for risk-aware applications

---

## Features

### Tools

| Tool | Description |
|------|-------------|
| `get_price_feeds` | Search and filter 1,930+ price feeds by symbol, asset type, or query |
| `get_latest_price` | Fetch real-time prices with confidence intervals and publish times |
| `get_price_at_timestamp` | Query historical prices at specific Unix timestamps |
| `get_ema_price` | Get Exponential Moving Average prices with deviation analysis |
| `get_twap` | Calculate time-weighted average prices (1-600 second windows) |
| `get_publisher_caps` | Access publisher staking limits and network health data |
| `get_price_feed_info` | Detailed metadata for specific price feeds |
| `get_historical_prices` | Query historical price data over time ranges |
| `get_ohlcv` | Get OHLCV candlestick data (TradingView format) |
| `search_symbols` | Search for price feed symbols by name |
| `get_popular_feeds` | Curated list of popular feed IDs (BTC, ETH, stablecoins, etc.) |

### Resources

| Resource URI | Description |
|--------------|-------------|
| `pyth://network/status` | Network health, supported chains, and statistics |
| `pyth://feeds/catalog` | Complete catalog of available price feeds |
| `pyth://feeds/popular` | Commonly used feeds (BTC, ETH, SOL, major pairs) |
| `pyth://docs/api` | Quick reference for Hermes API endpoints |
| `pyth://docs/integration` | Integration guides and best practices |

### Prompts

| Prompt | Description |
|--------|-------------|
| `analyze_price_feed` | Deep analysis of an asset with price, TWAP, volatility |
| `compare_assets` | Side-by-side comparison of multiple price feeds |
| `market_overview` | Comprehensive report for an asset category |
| `volatility_report` | Historical volatility metrics and risk assessment |
| `price_deviation_check` | Detect stablecoin depegs or feed anomalies across USD/USDC/USDT pairs |

---

## Installation

### Prerequisites

- Node.js 18+
- npm or pnpm

### Quick Start

```bash
# Clone and install
git clone https://github.com/pyth-network/mcp-server.git
cd mcp-server
pnpm install

# Build
pnpm build

# Run
pnpm start
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pyth-network": {
      "command": "node",
      "args": ["/path/to/pyth-mcp-server/dist/index.js"],
      "env": {
        "PYTH_HERMES_URL": "https://hermes.pyth.network"
      }
    }
  }
}
```

---

## Architecture

```
pyth-mcp-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── server.ts             # MCP server implementation
│   ├── api/
│   │   ├── hermes.ts         # Hermes API client
│   │   ├── benchmarks.ts     # Benchmarks API client
│   │   └── types.ts          # API response types
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── price-feeds.ts    # Price feed tools
│   │   ├── historical.ts     # Historical data tools
│   │   └── network.ts        # Network info tools
│   ├── resources/
│   │   ├── index.ts          # Resource registry
│   │   └── handlers.ts       # Resource handlers
│   ├── prompts/
│   │   ├── index.ts          # Prompt registry
│   │   └── templates.ts      # Prompt templates
│   └── types/
│       ├── mcp.ts            # MCP protocol types
│       └── pyth.ts           # Pyth-specific types
├── tests/
├── docs/
└── dist/
```

---

## API Reference

### Hermes API (Real-time Data)

Base URL: `https://hermes.pyth.network`

| Endpoint | Purpose |
|----------|---------|
| `/v2/price_feeds` | List all available price feeds |
| `/v2/updates/price/latest` | Get latest prices for feed IDs |
| `/v2/updates/price/{timestamp}` | Get prices at specific timestamp |
| `/v2/updates/twap/latest` | Get TWAP for feed IDs |
| `/v2/updates/publisher_stake_caps/latest` | Publisher staking data |

### Benchmarks API (Historical Data)

Base URL: `https://benchmarks.pyth.network`

| Endpoint | Purpose |
|----------|---------|
| `/v1/price_feeds/` | List price feeds with metadata |
| `/v1/updates/price/{timestamp}` | Historical price at timestamp |
| `/v1/updates/price/{timestamp}/{interval}` | Price history with intervals |
| `/v1/shims/tradingview/history` | TradingView-compatible OHLCV |

---

## Differences from Community Version

This official implementation provides several advantages over the community-built version:

| Feature | Community | Official |
|---------|-----------|----------|
| Language | Python | TypeScript |
| Type Safety | Runtime | Compile-time |
| Streaming | No | SSE support |
| Historical Data | Basic | Full Benchmarks API |
| Error Handling | Basic | Comprehensive with retries |
| Caching | None | Intelligent caching |
| Rate Limiting | None | Built-in respect for limits |
| Documentation | Good | Extensive |
| Maintenance | Community | Pyth Foundation |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTH_HERMES_URL` | `https://hermes.pyth.network` | Hermes API endpoint |
| `PYTH_BENCHMARKS_URL` | `https://benchmarks.pyth.network` | Benchmarks API endpoint |
| `PYTH_CACHE_TTL` | `5000` | Cache TTL in milliseconds |
| `PYTH_REQUEST_TIMEOUT` | `30000` | Request timeout in ms |
| `LOG_LEVEL` | `info` | Logging verbosity |

---

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests (unit tests only)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run integration tests against live Pyth APIs
RUN_INTEGRATION=true pnpm test

# Build for production
pnpm build

# Lint
pnpm lint

# Type check
pnpm typecheck
```

### Test Suite

The project includes comprehensive tests:

| Test File | Tests | Description |
|-----------|-------|-------------|
| `types.test.ts` | 21 | Zod schemas, utility functions |
| `errors.test.ts` | 21 | Error classes, wrapping |
| `api.test.ts` | 19 | Mocked API clients |
| `tools.test.ts` | 18 | All 11 tool handlers |
| `resources.test.ts` | 19 | All 5 resources |
| `prompts.test.ts` | 19 | All 5 prompts |
| `server.test.ts` | 4 | Server setup |
| `integration.test.ts` | 10 | Live API tests (skipped by default) |

**Total: 121 tests**

---

## Privacy Policy

This MCP server connects to Pyth Network's public APIs:
- **Hermes API** (https://hermes.pyth.network) - Real-time price data
- **Benchmarks API** (https://benchmarks.pyth.network) - Historical price data

### Data Collection

This server:
- **Does NOT** collect, store, or transmit any user data
- **Does NOT** require authentication or API keys for basic usage
- **Does NOT** log queries or track usage
- Only fetches publicly available price feed data from Pyth Network

### Third-Party Services

All price data is provided by Pyth Network. Please refer to [Pyth Network's Privacy Policy](https://pyth.network/privacy-policy) for information about their data practices.

### Local Processing

All data processing occurs locally on your machine. No data is sent to any servers other than the Pyth Network APIs for fetching price information.

---

## Support

- **Documentation:** [docs.pyth.network](https://docs.pyth.network)
- **Issues:** [GitHub Issues](https://github.com/Chop-Kampfire/pyth-mcp-server/issues)
- **Discord:** [Pyth Network Discord](https://discord.gg/pythnetwork)
- **Twitter:** [@PythNetwork](https://twitter.com/PythNetwork)

---

## License

Apache-2.0 License - see [LICENSE](LICENSE) for details.

---

## Links

- [Pyth Network](https://pyth.network)
- [Pyth Documentation](https://docs.pyth.network)
- [Hermes API](https://hermes.pyth.network/docs)
- [Benchmarks API](https://benchmarks.pyth.network/docs)
- [MCP Specification](https://modelcontextprotocol.io)
