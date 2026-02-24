# Pyth Pro MCP Server

MCP server that exposes Pyth Pro real-time and historical market data to AI assistants.

## Tools

| Tool | Description |
|------|-------------|
| `get_symbols` | Search and list available price feeds |
| `get_latest_price` | Real-time prices (requires access token) |
| `get_historical_price` | Point-in-time price snapshots |
| `get_candlestick_data` | OHLC candlestick bars |

## Setup

```sh
pnpm --filter @pythnetwork/mcp build
```

## Testing

### 1. MCP Inspector

Run the inspector to interactively call tools:

```sh
npx @modelcontextprotocol/inspector --cli -- pnpm --filter @pythnetwork/mcp start:dev
```

### 2. Claude Desktop / Claude Code

Add to your Claude config (`~/.claude.json` for Claude Code, or `claude_desktop_config.json` for Claude Desktop):

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

The access token is only needed for `get_latest_price`. All other tools work without it.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTH_PRO_ACCESS_TOKEN` | — | Bearer token for Router API |
| `PYTH_CHANNEL` | `fixed_rate@200ms` | Default price channel |
| `PYTH_LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `PYTH_REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout |
