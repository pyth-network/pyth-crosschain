# Pyth Pro MCP Server — Architecture & Implementation Plan

## Context

Pyth Pro delivers low-latency, cross-asset market data (crypto, equities, FX, metals, energy, rates) from first-party publishers via a subscription service. An MCP server wrapping these APIs would:

1. **Validate the agentic market data thesis** — prove that AI agents consuming real-time financial data is a viable product category
2. **Generate Pro subscription leads** — free feed discovery funnels users toward paid real-time and historical data
3. **Reduce integration friction** — AI assistants can fetch prices, analyze history, and generate integration code without users reading API docs

The server wraps two Pyth Pro APIs:
- **Router API** (`https://pyth-lazer.dourolabs.app`) — real-time/latest prices, requires bearer token
- **History API** (`https://pyth.dourolabs.app`) — symbols (public; a token reveals Pro-only feeds and `entitled_only`), plus OHLC, point-in-time prices and price ranges (token-gated)

Both are called with plain `fetch`. The Lazer SDK is not used: since v7, `PythLazerClient.create()` always opens a WebSocket pool, which a per-call REST client cannot afford.

---

## Key Decisions

| Decision | Resolution |
|----------|-----------|
| Language | **TypeScript** — largest MCP ecosystem, npm distribution, fast to ship |
| Transport | **Stdio + HTTP** — local dev via stdio, remote deployment via HTTP |
| Package | **`@pythnetwork/mcp`**, private (not on npm). Users connect to the hosted server or run a local build. |
| Auth | **Every user brings their own key.** In order: the per-call `access_token`, then the key from the user's MCP client configuration (the `Authorization: Bearer` header of their HTTP request, or `PYTH_PRO_ACCESS_TOKEN` in the env their client gives a local stdio server). The HTTP server never reads `PYTH_PRO_ACCESS_TOKEN` from its own environment, so a hosted server can never answer with a shared key. Required for `get_latest_price`, `get_historical_price`, `get_price_range` and `get_candlestick_data`. Optional for `get_symbols`, where it adds Pro-only feeds and a per-feed `entitled` flag. 401 = invalid token, 403 = valid token without the entitlement (the message names the group). |
| Shared trial token | **Dropped** (2026-10). Conflicts with bring-your-own-key. |
| Graceful degradation | `get_symbols` (feed discovery) and `convert_date_to_timestamp` work **without** a token. `get_latest_price`, `get_historical_price`, `get_price_range` and `get_candlestick_data` require one and return a clear message, with setup steps, if it is missing or invalid. |
| Channel default | `fixed_rate@200ms` server-wide default via `PYTH_CHANNEL` env var. Per-tool `channel` parameter can override. Note: each feed has a minimum supported channel (most are 200ms, some support real_time). |
| Feed identifiers | Tools accept **both** `symbols` (string, e.g. `"BTC/USD"`) and `priceFeedIds` (numeric). LLMs will naturally use symbols. |
| Properties default | `[price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount, marketSession, feedUpdateTimestamp]` — any of the 13 Router properties can be requested per call. |
| Code sandbox | **v1.1 fast-follow** — standard tools in v1, sandbox execution tool in v1.1. Detailed plan below. |
| Prompts | **2-3 starter prompts** planned; not built yet |
| Hosting | **Hosted** at `https://mcp.pyth.network/mcp` (HTTP). Stdio for local builds. |
| Observability | **Full** — structured JSON logs, every tool invocation tracked |

---

## MCP Design Patterns (Applied to Pyth Pro)

Based on deep research of the TypeScript MCP SDK, popular MCP servers (Stripe, Cloudflare, Brave Search, Filesystem, Financial Datasets), Anthropic's engineering blog, and community best practices.

### Pattern 1: Zod-First Schema Validation
Define Zod schemas before handlers. The SDK auto-validates inputs and generates JSON Schema for tool definitions.

```typescript
import { z } from "zod";

const GetCandlestickDataInput = z.object({
  symbol: z.string().min(1).describe("Trading pair, e.g. BTC/USD"),
  resolution: z.enum(["1","5","15","30","60","120","240","360","720","D","W","M"]),
  from: z.number().int().positive().describe("Start time (Unix seconds)"),
  to: z.number().int().positive().describe("End time (Unix seconds)"),
  channel: z.string().optional().describe("Override default channel (e.g. fixed_rate@200ms)"),
});

server.registerTool("get_candlestick_data", {
  description: "...",
  inputSchema: GetCandlestickDataInput,
  annotations: { readOnlyHint: true },
}, async (params) => { /* validated & typed */ });
```

### Pattern 2: Two-Tier Error Handling
- **Protocol errors** (`throw new McpError(ErrorCode.InvalidParams, msg)`) — for malformed requests, unknown tools. Host sees these as failures.
- **Tool errors** (`return { content: [{ type: "text", text: msg }], isError: true }`) — for business logic failures (feed not found, rate limited, missing token). LLM sees these and can retry with different params.

### Pattern 3: Tool Annotations
All 4 tools are read-only and non-destructive:
```typescript
annotations: { readOnlyHint: true, destructiveHint: false }
```

### Pattern 4: Full Payload, No Signed Bytes
Return all fields from the `parsed` API response. Only exclude signed binary payload fields (`evm`, `solana`, `leUnsigned`/`leSigned` encoded bytes) — these are large, opaque, and useless to LLMs.
- **Router API** — return the full `parsed` response object. Strip only binary encoding fields (`evm`, `solana`, `leUnsigned`, `leSigned`).
- **History API** — return the full response as-is. Add `{ count, truncated }` metadata where applicable.

### Pattern 5: Response Size Limits
- `get_symbols`: Default limit 50 results, max 200. Include `{ count, total_available, has_more }`.
- `get_candlestick_data`: Max 500 candles per request. If truncated, include `{ truncated: true, returned: 500, hint: "narrow your time range or use a larger resolution" }`.
- `get_historical_price` / `get_latest_price`: No limit needed (user specifies exact feeds).

### Pattern 6: Stderr-Only Logging
```typescript
// Use pino to stderr (fd 2)
import pino from "pino";
const logger = pino({ transport: { target: "pino/file", options: { destination: 2 } } });
// NEVER console.log() in stdio mode — it corrupts JSON-RPC
```

### Pattern 7: LLM-Optimized Tool Descriptions
Each description should answer: What does it do? When should you use it? What do inputs/outputs look like?

Example:
```
"List available Pyth Pro price feeds. Use this FIRST to discover what feeds exist
before calling get_latest_price or get_candlestick_data. Filter by asset_type (crypto, equity,
fx, metal, rates, commodity) or search by name/symbol. Returns feed metadata including
pyth_lazer_id (needed for get_historical_price), symbol, asset_type, and exponent."
```

### Pattern 8: In-Memory Testing
```typescript
const client = await server.testClient();
const result = await client.callTool("get_symbols", { query: "BTC" });
assert(result.content[0].text.includes("BTC/USD"));
```

### Pattern 9: Resource Caching
- `pyth://feeds` and `pyth://feeds/{asset_type}` — the `/v1/symbols` catalog is cached in memory for 5 minutes per token (public catalog pinned, outages remembered for 30 s). Before downloading a catalog for a new key, the server checks the key with a one-feed Router request: the symbols API answers made-up keys with 200 and the full public catalog, the Router with 401. Confirmed keys are cached for 5 minutes, rejected keys for 1 minute; if the Router is down the download goes ahead.
- `pyth://tradingview/config` — cache for 1 hour (configuration is static)
- OpenAPI specs — cache indefinitely (versioned content)

### Pattern 10: Graceful Shutdown
```typescript
const cleanup = async () => { await server.close(); process.exit(0); };
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
```

### Anti-Patterns to Avoid
1. **Raw API passthrough** — curate every response for LLM context efficiency
2. **No pagination on lists** — `get_symbols` has 2000+ feeds, always paginate
3. **`console.log()` in stdio** — corrupts JSON-RPC, use stderr only
4. **Silent failures** — every error must include an actionable message for the LLM
5. **Mega-server** — we have 4 focused tools, don't add more without clear demand
6. **Hardcoded secrets** — token from env var only, never in code or responses

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  MCP Clients                     │
│  (Claude Desktop, Cursor, VS Code, Agents)       │
└──────────────┬──────────────────┬───────────────┘
               │ stdio            │ HTTP
┌──────────────▼──────────────────▼───────────────┐
│                @pythnetwork/mcp                  │
│                                                   │
│  ┌─────────┐  ┌───────────┐  ┌─────────┐        │
│  │  Tools  │  │ Resources │  │ Prompts │        │
│  └────┬────┘  └─────┬─────┘  └────┬────┘        │
│       │              │              │             │
│  ┌────▼──────────────▼──────────────▼────┐       │
│  │         Middleware Layer               │       │
│  │  auth · logging · channel-resolution  │       │
│  └────┬─────────────────────────┬────────┘       │
│       │                         │                 │
│  ┌────▼────────┐     ┌─────────▼──────────┐     │
│  │ Router      │     │ History            │     │
│  │ Client      │     │ Client             │     │
│  │ (token req) │     │ (public + token)   │     │
│  └────┬────────┘     └─────────┬──────────┘     │
└───────│─────────────────────────│────────────────┘
        │                         │
  ┌─────▼─────────┐   ┌──────────▼──────────────┐
  │ Router API    │   │ History API             │
  │ pyth-lazer.   │   │ pyth.dourolabs.app      │
  │ dourolabs.app │   │                         │
  └───────────────┘   └─────────────────────────┘
```

---

## Tools (6 tools)

> The tool descriptions in `src/tools/` are the source of truth; this section summarizes them.

> **Naming convention:** Tool names match the underlying API endpoint names directly. Router API is only used for `get_latest_price` (real-time data requiring a token). The other price tools use the History API: `get_symbols` is public, while `get_historical_price`, `get_price_range` and `get_candlestick_data` require a token (from the client configuration, or per call as `access_token`).

**Shared by the price tools:**
- `access_token` (optional): only needed when the user's MCP client does not send a key (see Auth in Key Decisions).
- `symbols` (and `get_candlestick_data`'s single `symbol`) accept full symbols (`Crypto.BTC/USD`) or bare pairs (`BTC/USD`). A bare pair resolves to the live spot feed, otherwise to the only remaining live match; an ambiguous input returns an error listing the candidates. `resolved_symbols` in the response shows each mapping.
- In the tools that take both, if `price_feed_ids` and `symbols` are given, only the IDs are used.
- `channel`: `real_time`, `fixed_rate@50ms`, `fixed_rate@200ms` or `fixed_rate@1000ms`; default `fixed_rate@200ms` (`PYTH_CHANNEL`). Must not be faster than the feed's `min_channel`.
- `get_latest_price` and `get_historical_price` list requested feeds that return no price (e.g. `beta` or `coming_soon` feeds) in `missing_feed_ids`. `get_price_range` has no such field; `get_candlestick_data` reports an empty result with `candles: 0` and a `hint`.
- Prices are integers with an `exponent` (candles excepted: they are already in display units); `display_*` fields (`display_price`, `display_bid`, `display_ask`, `display_confidence`, `display_ema_price`, `display_ema_confidence`, `display_funding_rate`) apply it.
- Every response carries `server_time_utc` and `server_unix_seconds`.

### Toolset: `discovery` (no token needed)

#### 1. `get_symbols`
> List and filter Pyth Pro price feeds across all asset classes.

| Field | Value |
|-------|-------|
| API | `GET /v1/symbols` (History API); with a token, also `GET /v1/symbols?entitled_only=true` |
| Auth | Optional: adds Pro-only feeds and a per-feed `entitled` flag |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | No | Text filter on symbol, name and description (e.g. "BTC", "gold", "AAPL") |
| `asset_type` | string | No | `crypto`, `crypto-index`, `crypto-redemption-rate`, `fx`, `equity`, `metal`, `rates`, `interest-rate`, `nav`, `commodity`, `funding-rate`, `eco`, `kalshi` |
| `instrument_type` | string | No | `spot`, `future`, `perp`, `rate`, `index`, `nav` |
| `symbol_chain_id` | string | No | Futures chain, exact and case-sensitive (e.g. `VX`) |
| `include_inactive` | boolean | No | Include retired feeds (default `false`) |
| `verbose` | boolean | No | Return every catalog field, e.g. `market_sessions`, `corporate_actions` (default `false`) |
| `limit` | number | No | Results per page (default 50, max 200) |
| `offset` | number | No | Pagination offset (default 0) |
| `access_token` | string | No | The user's own token |

**Returns:** `{ feeds, count, total_available, offset, has_more, next_offset, note? }`. Each feed is compact by default: `pyth_lazer_id`, `symbol`, `name`, `description`, `asset_type`, `instrument_type`, `state`, `exponent`, `min_channel`, `quote_currency`, plus `groups`, `expiration_time` and `symbol_chain_id` where set. With a token, each feed has `entitled`, and `not_entitled_reason` when it is `false` (not live yet, or the plan lacks an entitlement group).

---

#### 2. `convert_date_to_timestamp`
> Convert a date to Unix timestamps for the other tools.

| Field | Value |
|-------|-------|
| API | None (computed locally) |
| Auth | None |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `date_string` | string | Yes | ISO 8601 / RFC 3339, e.g. `2026-01-01T00:00:00Z` or `2026-01-01`. Dates without a timezone are UTC |

**Returns:** `{ input, iso8601, unix_seconds, unix_microseconds, is_in_valid_range, valid_range }`. `valid_range` runs from 2025-04-01, when historical data starts, to now.

---

### Toolset: `history` (History API, token required)

#### 3. `get_historical_price`
> Prices for one or more feeds at one past instant.

| Field | Value |
|-------|-------|
| API | `GET /v1/{channel}/price` (History API) |
| Auth | Required (client-configured key or per-call `access_token`) |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `price_feed_ids` | number[] | No* | Feed IDs, max 50 |
| `symbols` | string[] | No* | Symbols or bare pairs, max 50 |
| `timestamp` | number | Yes | Unix seconds, milliseconds or microseconds (auto-detected by magnitude), aligned down to the channel interval |
| `channel` | string | No | Override the default channel |

*At least one of `price_feed_ids` or `symbols` required.

**Returns:** `{ prices, missing_feed_ids?, resolved_symbols? }`. Each row has every field the API returns plus `display_*`. When nothing is found, `prices` is empty, with a `hint` (too early, in the future, or no data) and `valid_range`.

---

#### 4. `get_price_range`
> Every price update for one or more feeds within a window of at most 60 seconds.

| Field | Value |
|-------|-------|
| API | `GET /v1/{channel}/price/range` (History API) |
| Auth | Required (client-configured key or per-call `access_token`) |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `price_feed_ids` | number[] | No* | Feed IDs, max 50 |
| `symbols` | string[] | No* | Symbols or bare pairs, max 50 |
| `start` | number | Yes | Window start, inclusive; seconds, ms or µs |
| `end` | number | Yes | Window end, inclusive; at most 60 s after `start` (checked locally), equal for one instant |
| `limit` | number | No | Rows per page (default 100, max 500; the API allows 1000) |
| `after` | string | No | Paging cursor: `next_cursor` from the previous page |
| `channel` | string | No | Override the default channel |

*At least one of `price_feed_ids` or `symbols` required.

**Returns:** `{ prices, count, has_more, next_cursor, channel, window, resolved_symbols? }`. Each row is one update for one feed, with `display_*`.

---

#### 5. `get_candlestick_data`
> OHLC candles for one feed, for charting and technical analysis.

| Field | Value |
|-------|-------|
| API | `GET /v1/{channel}/history` (History API) |
| Auth | Required (client-configured key or per-call `access_token`) |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbol` | string | Yes | One symbol or bare pair (e.g. `BTC/USD`) |
| `resolution` | string | Yes | `1`, `5`, `15`, `30`, `60`, `120`, `240`, `360`, `720` (minutes), `D`, `W`, `M` |
| `from` | number | Yes | Start time, Unix seconds only |
| `to` | number | Yes | End time, Unix seconds only |
| `channel` | string | No | Override the default channel |

**Returns:** `{ s: "ok", t, o, h, l, c, v }`, already in display units. Over 500 candles, the first 500 come back with `truncated: true`, `returned`, `total_available` and a `hint`. With no data, `candles: 0`, a `hint` and `valid_range`. For funding-rate feeds the candles chart the mark price, not the rate.

---

### Toolset: `prices` (Router API, token required)

#### 6. `get_latest_price`
> The most recent price data for one or more feeds.

| Field | Value |
|-------|-------|
| API | `POST /v1/latest_price` (Router API) |
| Auth | Required (client-configured key or per-call `access_token`) |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `price_feed_ids` | number[] | No* | Feed IDs, max 100 |
| `symbols` | string[] | No* | Symbols or bare pairs, max 100 |
| `properties` | string[] | No | Any of the 13 Router properties: `price`, `bestBidPrice`, `bestAskPrice`, `exponent`, `publisherCount`, `confidence`, `fundingRate`, `fundingTimestamp`, `fundingRateInterval`, `marketSession`, `emaPrice`, `emaConfidence`, `feedUpdateTimestamp`. Default: the first six plus `marketSession` and `feedUpdateTimestamp` |
| `channel` | string | No | Override the default channel |

*At least one of `price_feed_ids` or `symbols` required.

**Returns:** `{ prices, missing_feed_ids?, resolved_symbols? }`. Each row has `price_feed_id`, `timestamp_us` and the requested properties in snake_case (`best_bid_price`, `market_session`, `funding_rate`, …), plus `display_*`. Signed payloads (`evm`, `solana`, …) are never requested.

**Error when no token:** "This tool requires your Pyth Pro access token. Pass it as the `access_token` parameter, or configure it once in your MCP client (an `Authorization: Bearer <token>` header for the hosted server, or PYTH_PRO_ACCESS_TOKEN for a local stdio server). Get a token at https://docs.pyth.network/price-feeds/pro/acquire-api-key"

---

## Resources (2 built, 7 planned)

> Built: `pyth://feeds` and `pyth://feeds/{asset_type}`. The rest are planned.

### Static documentation resources

| URI | Description | Source |
|-----|-------------|--------|
| `pyth://docs/integration-guide` | What Pyth Pro is, how to get a token, SDK install, connection code snippets, API reference links | Static content |
| `pyth://docs/chains` | Supported blockchains for on-chain price verification | Static content |
| `pyth://schema/streaming_payload` | Streaming payload schema reference — AsyncAPI spec for WebSocket streaming format, field definitions, exponent math | Adapted from Pyth docs |
| `pyth://schema/errors` | Error code taxonomy with causes and resolution steps | Compiled from OpenAPI specs |
| `pyth://schema/openapi/rest` | Router API OpenAPI spec | Fetched from `pyth-lazer-0.dourolabs.app/docs/openapi.json` |
| `pyth://schema/openapi/history` | History API OpenAPI spec | Fetched from `history.pyth-lazer.dourolabs.app/docs/v1/openapi.json` |

### Dynamic resources

| URI | Description | Source |
|-----|-------------|--------|
| `pyth://feeds` | Full feed catalog (all asset types) | `GET /symbols` (History API), cached 5 minutes |
| `pyth://feeds/{asset_type}` | Feeds filtered by asset type (template) | `GET /symbols`, filtered client-side, cached 5 minutes |
| `pyth://tradingview/config` | TradingView-compatible configuration (supported resolutions, capabilities) | `GET /{channel}/config` (History API) |

---

## Prompts (3 starters, planned)

> Not built yet.

### 1. `market_snapshot`
> Cross-asset market overview — crypto, equities, FX, commodities in one view.

**Description:** *"Get a comprehensive market snapshot across all asset classes. Shows top movers, current prices, and bid/ask spreads for representative feeds in each category."*

**Tools orchestrated:** `get_symbols` → `get_latest_price` (batch across asset classes)

**Example user query:** *"Give me a market snapshot"*

**Expected output:** Formatted table with representative feeds per asset class, current price, bid/ask spread, publisher count.

---

### 2. `price_analysis`
> Analyze a specific asset's price history with key statistics.

**Description:** *"Analyze recent price action for any Pyth Pro feed. Shows OHLC data, price change, high/low range, and basic statistics over a configurable time period."*

**Tools orchestrated:** `get_candlestick_data` → `get_latest_price`

**Example user query:** *"Analyze BTC price action over the last 7 days"*

**Expected output:** Current price, 7d change %, period high/low, daily OHLC summary, volume if available.

---

### 3. `setup_pyth_pro`
> Step-by-step guide to integrate Pyth Pro into your application.

**Description:** *"Generate a complete Pyth Pro integration guide tailored to your tech stack. Includes SDK installation, connection code, price subscription setup, and on-chain verification."*

**Tools orchestrated:** `get_symbols` (to show available feeds) + `pyth://docs/integration-guide` resource

**Example user query:** *"Help me set up Pyth Pro in my Next.js app"*

**Expected output:** Step-by-step guide with code snippets for the user's stack.

---

## Error Taxonomy

| Error | HTTP Code | Tool Behavior | LLM-Facing Message |
|-------|-----------|---------------|---------------------|
| Missing token | — | Return tool error | "This tool requires your Pyth Pro access token. Pass it as the `access_token` parameter, or configure it once in your MCP client (an `Authorization: Bearer <token>` header for the hosted server, or PYTH_PRO_ACCESS_TOKEN for a local stdio server). Get a token at https://docs.pyth.network/price-feeds/pro/acquire-api-key" |
| Invalid token | 401 | Return tool error | "Your Pyth Pro access token is invalid or expired. Check the `access_token` you passed, or the token configured in your MCP client." |
| Not entitled | 403 | Return tool error | "Pyth Pro denied access (403): <upstream reason>. Your access token is valid, but your plan is not entitled to this feed. …" |
| Feed not found | 400/404 | Return tool error | "Feed not found: {symbol}. Use get_symbols to discover available feeds." |
| Timestamp not found | 404 | Return tool error | "No price data available at the requested timestamp. Try a different timestamp or check if the market was open." |
| API timeout | — | Return tool error | "Pyth Pro API timed out. Try again or reduce the number of feeds." |
| Invalid channel | 400 | Return tool error | "Invalid channel: {channel}. Valid channels: real_time, fixed_rate@50ms, fixed_rate@200ms, fixed_rate@1000ms" |
| Invalid resolution | 400 | Return tool error | "Invalid OHLC resolution: {resolution}. Valid: 1, 5, 15, 30, 60, 120, 240, 360, 720, D, W, M" |

---

## Observability — Tracking Schema

Every tool invocation logs a structured JSON event:

```typescript
interface ToolInvocationLog {
  // Identity
  timestamp: string;           // ISO 8601
  request_id: string;          // UUID per request
  session_id: string;          // Correlates requests in a session
  transport: "stdio" | "http"; // Which transport mode

  // Tool info
  tool_name: string;           // e.g. "get_latest_price"
  mcp_method: string;          // e.g. "tools/call"

  // Request details
  symbols_queried: string[];   // Symbols requested
  feed_ids_queried: number[];  // Feed IDs requested
  asset_types: string[];       // Asset types involved
  channel: string;             // Channel used
  properties: string[];        // Properties requested
  num_feeds: number;           // Number of feeds in request
  request_size_bytes: number;

  // Auth
  has_token: boolean;          // Whether Pro token was provided
  token_hash: string;          // SHA-256 of token, truncated to 8 hex chars (never raw prefix)

  // Response
  status: "success" | "error";
  error_type?: string;         // Categorized: "auth", "not_found", "timeout", "invalid_input", "upstream"
  error_message?: string;
  response_size_bytes: number;
  num_feeds_returned: number;

  // Performance
  latency_ms: number;          // Total handler time
  api_latency_ms: number;      // Time in Pyth API call

  // Client info (HTTP only)
  user_agent?: string;
  client_ip_hash?: string;     // Hashed, not raw IP
}
```

**Destination:** Structured JSON to **stderr** (all modes). Never stdout in stdio mode — it corrupts JSON-RPC. Designed for ingestion into Grafana/Loki/CloudWatch.

---

## Project Structure

```
apps/mcp/  (@pythnetwork/mcp)
├── src/
│   ├── index.ts                  # Stdio entry point; reads PYTH_PRO_ACCESS_TOKEN
│   ├── http.ts                   # HTTP entry point; /mcp, /health, /metrics
│   ├── server.ts                 # MCP server creation and registration
│   ├── config.ts                 # Configuration from env vars
│   ├── constants.ts              # Channels, properties, asset/instrument types, resolutions
│   ├── metrics.ts                # Prometheus metrics
│   │
│   ├── clients/
│   │   ├── router.ts             # Router API client (POST /v1/latest_price), key check
│   │   ├── history.ts            # History API client (GET /v1/symbols, /v1/{channel}/*)
│   │   ├── symbols-store.ts      # Module-level TTL caches (catalog, entitlements, key checks)
│   │   ├── retry.ts              # HttpError, single retry
│   │   └── types.ts              # API response schemas
│   │
│   ├── tools/
│   │   ├── index.ts              # Tool registry
│   │   ├── price-tool.ts         # Shared token, feed-resolution and error handling
│   │   ├── descriptions.ts       # Shared description fragments
│   │   ├── get-symbols.ts
│   │   ├── get-latest-price.ts
│   │   ├── get-historical-price.ts
│   │   ├── get-price-range.ts
│   │   ├── get-candlestick-data.ts
│   │   └── convert-date-to-timestamp.ts
│   │
│   ├── resources/
│   │   └── index.ts              # pyth://feeds, pyth://feeds/{asset_type}
│   │
│   └── utils/
│       ├── access-token.ts       # Token validation; per-call vs client-configured key
│       ├── channel.ts            # Channel: per call, else PYTH_CHANNEL, else default
│       ├── display-price.ts      # display_* fields
│       ├── errors.ts             # LLM-facing error messages
│       ├── feeds.ts              # Feed state helpers
│       ├── logger.ts             # Structured JSON logger, token redaction
│       ├── missing-feeds.ts      # missing_feed_ids
│       ├── resolve-symbols.ts    # Bare-symbol resolution
│       └── timestamp.ts          # Timestamp normalization
│
├── skills/                       # Agent skills that use the tools
├── tests/                        # clients/, tools/, utils/, integration/ (stdio)
├── docs/PLAN.md
├── server.json                   # MCP registry metadata
├── package.json
├── tsconfig.json
└── README.md
```

---

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PYTH_CHANNEL` | `fixed_rate@200ms` | Default price channel |
| `PYTH_ROUTER_URL` | `https://pyth-lazer.dourolabs.app` | Router API base URL |
| `PYTH_HISTORY_URL` | `https://pyth.dourolabs.app` | History API base URL |
| `PYTH_LOG_LEVEL` | `info` | Log level: debug, info, warn, error. Logs go to stderr, so stdio JSON-RPC stays clean |
| `PYTH_REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout in milliseconds |
| `PYTH_PRO_ACCESS_TOKEN` | — | The user's own key, **stdio only**. The HTTP server never reads it |
| `PORT` | `8080` | HTTP server port |

**Run:**
```bash
# Stdio mode (a local server for one user's client)
pnpm --filter @pythnetwork/mcp start:stdio

# HTTP mode (the hosted server)
pnpm --filter @pythnetwork/mcp start
```

---

## v1.1 — Code Sandbox Tool (Detailed Plan)

### Overview
Add an `execute_analysis` tool that accepts TypeScript code, runs it in an isolated V8 sandbox with Pyth API bindings pre-injected, and returns the result. This enables multi-step financial analysis in a single tool call.

### Tool: `execute_analysis`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | TypeScript code to execute |
| `timeout_ms` | number | No | Max execution time (default: 10000, max: 30000) |

### Sandbox Environment

**Runtime:** `isolated-vm` (V8 isolate for Node.js) — provides memory isolation, CPU timeouts, and no ambient capabilities.

**Pre-injected API bindings:**
```typescript
// Available as global `pyth` object in sandbox — names match MCP tool names
interface PythBindings {
  getSymbols(query?: string, assetType?: string): Promise<Symbol[]>;
  getCandlestickData(symbol: string, resolution: string, from: number, to: number): Promise<OHLCData>;
  getHistoricalPrice(ids: number[], timestamp: number): Promise<PriceResponse[]>;
  getLatestPrice(symbols: string[], properties?: string[]): Promise<PriceData>;
}
```

**Pre-injected math utilities:**
```typescript
// Available as global `indicators` object in sandbox
interface TechnicalIndicators {
  sma(data: number[], period: number): number[];
  ema(data: number[], period: number): number[];
  rsi(data: number[], period: number): number[];
  bollingerBands(data: number[], period: number, stdDev?: number): { upper: number[], middle: number[], lower: number[] };
  macd(data: number[], fast?: number, slow?: number, signal?: number): { macd: number[], signal: number[], histogram: number[] };
  percentChange(from: number, to: number): number;
  standardDeviation(data: number[]): number;
}
```

### Security Constraints
- **No network access** — sandbox cannot make HTTP requests. All API calls go through the `pyth` binding, which calls the server's own API clients.
- **No filesystem access** — no `fs`, `path`, `child_process`, etc.
- **Memory limit** — 128MB per execution
- **CPU timeout** — configurable, default 10 seconds, max 30 seconds
- **No `eval` or dynamic imports** — code is static
- **Token isolation** — the Pyth Pro access token is held by the server-side binding implementation. The sandbox code calls `pyth.getLatestPrices(...)` but never sees the token.

### Example usage
```
User: "Compare BTC and ETH 30-day moving averages with Bollinger Bands"

LLM writes code → execute_analysis tool:

const now = Math.floor(Date.now() / 1000);
const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

const [btc, eth] = await Promise.all([
  pyth.getCandlestickData("BTC/USD", "D", thirtyDaysAgo, now),
  pyth.getCandlestickData("ETH/USD", "D", thirtyDaysAgo, now),
]);

const btcMA = indicators.sma(btc.c, 20);
const ethMA = indicators.sma(eth.c, 20);
const btcBB = indicators.bollingerBands(btc.c, 20, 2);

return {
  btc: { currentPrice: btc.c.at(-1), sma20: btcMA.at(-1), bollingerUpper: btcBB.upper.at(-1), bollingerLower: btcBB.lower.at(-1) },
  eth: { currentPrice: eth.c.at(-1), sma20: ethMA.at(-1) },
};
```

**Result returned to LLM (compact, no raw candle data):**
```json
{
  "btc": { "currentPrice": 97423.5, "sma20": 95102.3, "bollingerUpper": 101234.2, "bollingerLower": 88970.4 },
  "eth": { "currentPrice": 3412.8, "sma20": 3289.1 }
}
```

### Implementation approach
1. Add `isolated-vm` as dependency
2. Create `src/sandbox/` module:
   - `sandbox.ts` — isolate creation, code compilation, execution
   - `bindings.ts` — Pyth API binding implementations (calls server's own clients)
   - `indicators.ts` — technical indicator implementations
   - `types.ts` — TypeScript type definitions injected into sandbox
3. Create `src/tools/execute-analysis.ts` — MCP tool wrapper
4. Add comprehensive tests: security (escape attempts), timeout, memory limits, happy path

### v1.1 Observability additions
Same tracking schema as v1, plus:
- `code_length` — characters of submitted code
- `sandbox_memory_mb` — peak memory usage
- `sandbox_duration_ms` — execution time inside isolate
- `api_calls_from_sandbox` — number of Pyth API calls made by the code
- `sandbox_error_type` — "timeout", "memory", "syntax", "runtime", "security"

---

## v1.2 — Auto-Update Key Types (TBD)

Automatically fetch and update key data types (Channel, AssetType, MarketSession, PriceFeedProperty, etc.) from the live server rather than hardcoding them. Details to be determined.

---

## v2 — Shared Trial Token (Summary) — DROPPED

> Dropped in 2026-10: every user brings their own key, from their MCP client configuration or per call as `access_token`; the hosted server ignores any key in its own environment. Kept for history.

- Server holds a `PYTH_PRO_SERVER_TOKEN` (env var, never exposed to clients)
- When user has no `PYTH_PRO_ACCESS_TOKEN`, server uses its own token for Router API calls
- **Rate limiting per session:** Max N requests/minute per session (configurable)
- **Watermark:** Responses include a note: *"Using Pyth Pro trial access. Get your own token for unlimited access at https://pyth.network/pricing"*
- **Token never exposed:** The shared token is used server-side only. LLMs and clients never see it.
- **Analytics flag:** `is_trial: true` in tracking schema to measure conversion funnel

---

## Verification Plan

### Unit tests
- Each tool handler tested with mocked API responses
- Router client: mock HTTP responses for `/v1/latest_price`, `/v1/price`
- History client: mock HTTP responses for `/symbols`, `/{channel}/history`, `/{channel}/price`, `/{channel}/symbols`
- Auth middleware: test token presence/absence, graceful degradation
- Channel resolution: test default, override, and feed minimum logic
- Error handling: test all error taxonomy entries

### Integration tests
- Start MCP server in stdio mode → send JSON-RPC requests → validate responses
- Test without token: `get_symbols` works, `get_latest_price` returns auth error
- Test with token: all tools return valid data
- Test invalid symbols: proper error messages

### E2E tests (requires real Pyth Pro token)
- `PYTH_PRO_E2E_TOKEN` env var
- Test each tool against real API
- Validate response shapes match expected schemas
- Test OHLC data for known historical periods
- Test symbol search returns expected feeds

### Manual smoke test
```bash
# 1. Connect Claude Code to the hosted server with your own key
claude mcp add --transport http pyth https://mcp.pyth.network/mcp --header "Authorization: Bearer YOUR_TOKEN"

#    or to a local build over stdio
pnpm --filter @pythnetwork/mcp build
claude mcp add pyth-local -e PYTH_PRO_ACCESS_TOKEN=YOUR_TOKEN -- node <path-to-repo>/apps/mcp/dist/index.js

# 2. Test queries:
# "What crypto feeds are available on Pyth Pro?"        → get_symbols
# "What's the current price of BTC?"                    → get_latest_price
# "Show me ETH/USD daily candles for the last month"    → get_candlestick_data
# "Give me a market snapshot"                           → market_snapshot prompt
```

---

## Decision Log

All architectural decisions made during the brainstorming session, with rationale:

| # | Decision | Options Considered | Chosen | Rationale |
|---|----------|--------------------|--------|-----------|
| 1 | MCP purpose | Market data only / Integration only / Both | **Both** | MCP tools serve data extraction; resources and prompts drive Pro integration and SDK adoption |
| 2 | Language | TypeScript / Go / Rust / Python | **TypeScript** | Largest MCP ecosystem, npm distribution, fastest to ship. Rust was evaluated (Pyth DNA, performance) and confirmed TypeScript as the right choice for ecosystem reach and shipping speed. |
| 3 | Transport | Stdio only / Stdio+HTTP / HTTP only | **Stdio + HTTP** | Stdio for local dev (Claude Desktop, Cursor); HTTP for remote deployment. Both built from day one. |
| 4 | Auth v1 | Env var / Config file / OAuth / Per-call parameter | **The user's own key, from their client configuration or per call** (2026-10) | The per-call `access_token` wins; otherwise the client's `Authorization: Bearer` header (HTTP) or `PYTH_PRO_ACCESS_TOKEN` in the env the client gives a local stdio server. The server holds no key, so a hosted deployment can never share one across callers. |
| 5 | Auth v2 | Shared server token with rate limiting | **Dropped** (2026-10) | Every user brings their own key. The hosted server never reads a key from its own environment. |
| 6 | Graceful degradation | Always require token / Graceful / Separate toolsets | **Graceful degradation** | Symbol search is public — no reason to block it. Prices, history and OHLC need the user's key. Creates natural adoption funnel to Pro. |
| 7 | Feed identifiers | Symbols only / IDs only / Both | **Both** | LLMs naturally use symbols ("BTC/USD"). Power users and code may use numeric IDs. Accept both. |
| 8 | Channel default | Server-wide only / Per-tool only / Both | **Server-wide default + per-tool override** | Most feeds are 200ms. Default covers 90% of cases. Override for feeds supporting real_time. |
| 9 | Properties | Explicit selection / Return all / Sensible defaults | **Sensible defaults** | `[price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount, marketSession, feedUpdateTimestamp]` covers most use cases. All 13 Router properties can be requested. |
| 10 | TradingView endpoints | Skip / Resource only / Tools | **Resource only** | TradingView compat is for chart widgets, not LLM interactions. Expose config as resource for developers. |
| 11 | Code Mode | v1 / v1.1 / v2 | **v1.1 fast-follow** | Hybrid approach: standard MCP tools in v1, `execute_analysis` sandbox tool in v1.1. Ship tools first, add code execution once tool usage patterns are understood. |
| 12 | Code sandbox runtime | Cloudflare Workers / isolated-vm / quickjs | **isolated-vm** (v1.1) | V8 isolate in Node.js. Works anywhere (not CF-locked). Memory/CPU isolation. Well-maintained. |
| 13 | Prompts | Defer to v2 / Include 2-3 starters | **Include 3 starters** (not built yet) | `market_snapshot`, `price_analysis`, `setup_pyth_pro`. Low effort, high demo value for generating Pro leads. |
| 14 | Hosting | Cloudflare Workers / Docker / Decide later | **Hosted HTTP** (was: decide later) | The HTTP server runs at `https://mcp.pyth.network/mcp`; stdio remains for local builds. |
| 15 | Observability | Minimal / Analytics / Full | **Full observability** | 20+ fields per invocation. Structured JSON logs for Grafana/Loki. Tracks usage analytics + operational health. |
| 16 | Package name | @pyth-network/mcp-server / pyth-pro-mcp-server | **`@pythnetwork/mcp`** (private) | Follows the monorepo's `@pythnetwork/*` naming. Not published to npm: users connect to the hosted server or run a local build. |

