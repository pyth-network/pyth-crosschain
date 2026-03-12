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
| `get_symbols` | Search and list available price feeds | No |
| `get_latest_price` | Real-time prices for one or more feeds | Yes (access token) |
| `get_historical_price` | Point-in-time price snapshots | No |
| `get_candlestick_data` | OHLC candlestick bars for charting and analysis | No |
| `convert_date_to_timestamp` | Convert date strings to Unix timestamps | No |

> **Tip:** Use `get_symbols` first to discover available feeds before calling other tools.

## Access Token

An access token is only required for `get_latest_price`. All other tools work without one.

- Get a token at [pyth.network/pricing](https://pyth.network/pricing)
- The token is passed as a tool parameter — your AI assistant will ask for it when needed

## Example Queries

Try these with any connected AI assistant:

- "What's the current price of Bitcoin?"
- "Show me the ETH/USD price history for the last 24 hours"
- "Compare the prices of gold and silver right now"
- "Get daily candlestick data for AAPL over the past week"
- "What crypto price feeds are available on Pyth?"

## Local Development

For contributors working on the MCP server itself.

### Build

```sh
pnpm --filter @pythnetwork/mcp build
```

### MCP Inspector

Run the inspector to interactively test tools:

```sh
npx @modelcontextprotocol/inspector --cli -- pnpm --filter @pythnetwork/mcp start:dev
```

### Local stdio config

To connect a client to a local build via stdio:

```json
{
  "mcpServers": {
    "pyth-mcp": {
      "command": "node",
      "args": ["<path-to-repo>/apps/mcp/dist/index.js"],
      "env": {
        "PYTH_PRO_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTH_PRO_ACCESS_TOKEN` | — | Bearer token for Router API |
| `PYTH_CHANNEL` | `fixed_rate@200ms` | Default price channel |
| `PYTH_LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `PYTH_REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout |

## Links

- [Pyth Pro Documentation](https://docs.pyth.network/price-feeds/pro)
- [Get an Access Token](https://docs.pyth.network/price-feeds/pro/acquire-access-token)
- [Pricing](https://pyth.network/pricing)
- [GitHub Repository](https://github.com/pyth-network/pyth-crosschain/tree/main/apps/mcp)
