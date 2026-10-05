# Pyth Pro MCP Server

MCP server that gives AI assistants access to real-time and historical market data from [Pyth](https://pyth.network) — 500+ price feeds across crypto, equities, FX, commodities, and more.

Hosted at `https://mcp.pyth.network/mcp`

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pyth": {
      "url": "https://mcp.pyth.network/mcp"
    }
  }
}
```

### Claude Code

```sh
claude mcp add pyth --transport http https://mcp.pyth.network/mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "pyth": {
      "url": "https://mcp.pyth.network/mcp"
    }
  }
}
```

### Windsurf / Other Clients

Any MCP client that supports StreamableHTTP can connect using the URL:

```
https://mcp.pyth.network/mcp
```

## Tools

| Tool | Description | Auth Required |
|------|-------------|---------------|
| `get_symbols` | Search and list price feeds; filter by asset type, instrument type or futures chain | Optional (adds Pro-only feeds and an `entitled` flag per feed) |
| `get_latest_price` | Real-time prices for one or more feeds | Yes (access token) |
| `get_historical_price` | Point-in-time price snapshots | Yes (access token) |
| `get_price_range` | Every price update within a window of up to 60 seconds | Yes (access token) |
| `get_candlestick_data` | OHLC candlestick bars for charting and analysis | Yes (access token) |
| `convert_date_to_timestamp` | Convert date strings to Unix timestamps | No |

> **Tip:** Use `get_symbols` first to discover available feeds. Price tools accept full symbols (`Crypto.BTC/USD`) or bare pairs (`BTC/USD`). A bare pair resolves to the live spot feed when there is one, otherwise to the only remaining match (e.g. `BTC/USDT` → the Binance funding-rate feed); if several remain, the error lists them.

## Access Token

Every user brings their own Pyth Pro access token. It is required for `get_latest_price`, `get_historical_price`, `get_price_range` and `get_candlestick_data`. `get_symbols` works without one, but with a token it also lists feeds visible only to Pro keys and marks each feed `entitled: true/false` (whether your token can query it right now). `convert_date_to_timestamp` never needs one.

- Get a token at [pyth.network/pricing](https://pyth.network/pricing)
- Pass the token as the `access_token` tool parameter; your AI assistant will ask for it when needed. This applies to the hosted and local servers alike: the server never reads a key from its own environment.
- A 401 means the token is invalid or expired. A 403 means the token is valid but your plan is not entitled to that feed; the error names the entitlement group required.
- Only feeds in state `stable` return prices. Requested feeds that come back without a price (e.g. `beta` or `coming_soon` feeds, or a channel faster than the feed's `min_channel`) are listed in `missing_feed_ids`.

## Example Queries

Try these with any connected AI assistant:

- "What's the current price of Bitcoin?"
- "Show me the ETH/USD price history for the last 24 hours"
- "Compare the prices of gold and silver right now"
- "Get daily candlestick data for AAPL over the past week"
- "What crypto price feeds are available on Pyth?"
- "Show every BTC/USD price update in the 30 seconds after 14:30 UTC today"
- "Which VIX futures contracts does Pyth have?"

## Local Development

For contributors working on the MCP server itself.

### Build

```sh
pnpm --filter @pythnetwork/mcp build
```

### MCP Inspector

Run the inspector to interactively test tools:

```sh
npx @modelcontextprotocol/inspector --cli -- pnpm --filter @pythnetwork/mcp start:stdio:dev
```

### Local stdio config

To connect a client to a local build via stdio:

```json
{
  "mcpServers": {
    "pyth-mcp": {
      "command": "node",
      "args": ["<path-to-repo>/apps/mcp/dist/index.js"]
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTH_CHANNEL` | `fixed_rate@200ms` | Default price channel: `real_time`, `fixed_rate@50ms`, `fixed_rate@200ms` or `fixed_rate@1000ms` |
| `PYTH_LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `PYTH_REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout |

## Links

- [Pyth Pro Documentation](https://docs.pyth.network/price-feeds/pro)
- [Get an Access Token](https://docs.pyth.network/price-feeds/pro/acquire-access-token)
- [Pricing](https://pyth.network/pricing)
- [GitHub Repository](https://github.com/pyth-network/pyth-crosschain/tree/main/apps/mcp)
