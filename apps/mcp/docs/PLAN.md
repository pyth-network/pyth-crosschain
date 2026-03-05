# Pyth Pro MCP Server — Architecture & Implementation Plan

## Context

Pyth Pro delivers low-latency, cross-asset market data (crypto, equities, FX, metals, energy, rates) from first-party publishers via a subscription service. An MCP server wrapping these APIs would:

1. **Validate the agentic market data thesis** — prove that AI agents consuming real-time financial data is a viable product category
2. **Generate Pro subscription leads** — free-tier access to discovery/OHLC funnels users toward paid real-time feeds
3. **Reduce integration friction** — AI assistants can fetch prices, analyze history, and generate integration code without users reading API docs

The server wraps two Pyth Pro APIs:
- **Router API** (`https://pyth-lazer.dourolabs.app`) — real-time/latest prices, requires bearer token
- **History API** (`https://history.pyth-lazer.dourolabs.app`) — symbols, OHLC, historical prices, mostly public

---

## Key Decisions

| Decision | Resolution |
|----------|-----------|
| Language | **TypeScript** — largest MCP ecosystem, npm distribution, fast to ship |
| Transport | **Stdio + HTTP** — local dev via stdio, remote deployment via HTTP |
| Package | **`@pyth-network/mcp-server`** |
| Auth (v1) | User provides `PYTH_PRO_ACCESS_TOKEN` env var. Required for Router API tools. History API tools work without it. |
| Auth (v2) | Server holds a shared trial token (never exposed). Rate-limited per session. Falls back when user has no token. |
| Graceful degradation | History API tools (search, OHLC, historical prices) work **without** a token. Router API tools (latest prices) require a token and return a clear "bring your token" message if missing. |
| Channel default | `fixed_rate@200ms` server-wide default via `PYTH_CHANNEL` env var. Per-tool `channel` parameter can override. Note: each feed has a minimum supported channel (most are 200ms, some support real_time). |
| Feed identifiers | Tools accept **both** `symbols` (string, e.g. `"BTC/USD"`) and `priceFeedIds` (numeric). LLMs will naturally use symbols. |
| Properties default | `[price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount]` — overridable per-tool call. |
| Code sandbox | **v1.1 fast-follow** — standard tools in v1, sandbox execution tool in v1.1. Detailed plan below. |
| Prompts | **2-3 starter prompts** in v1 |
| Hosting | **Decide later** — focus on stdio for v1 launch. HTTP mode built but hosting deferred. |
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
- `pyth://feeds` and `pyth://feeds/{asset_type}` — cache for 1 day (feed catalog rarely changes)
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
│            @pyth-network/mcp-server              │
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
  │ pyth-lazer.   │   │ history.pyth-lazer.     │
  │ dourolabs.app │   │ dourolabs.app           │
  └───────────────┘   └─────────────────────────┘
```

---

## Tools (4 tools)

> **Naming convention:** Tool names match the underlying API endpoint names directly. Router API is only used for `get_latest_price` (real-time data requiring a token). All other tools use the History API (public, no token needed).

### Toolset: `discovery` (public, no token needed)

#### 1. `get_symbols`
> List and filter available Pyth Pro price feeds across all asset classes.

| Field | Value |
|-------|-------|
| API | `GET /symbols` (History API) |
| Auth | None |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | No | Text filter (e.g. "BTC", "gold", "AAPL") |
| `asset_type` | string | No | Filter: `crypto`, `fx`, `equity`, `metal`, `rates`, `commodity`, `funding-rate` |
| `offset` | number | No | Pagination offset (default 0) |
| `limit` | number | No | Results per page (default 50, max 200) |

**Returns:** Array of `{ pyth_lazer_id, name, symbol, description, asset_type, exponent, min_channel, state, hermes_id, quote_currency }`

**LLM description:** *"List available Pyth Pro price feeds. Use this to discover what feeds exist before fetching prices. You can filter by asset type (crypto, equity, fx, metal, rates, commodity) or search by name/symbol."*

---

#### 2. `get_candlestick_data`
> Get OHLC (Open/High/Low/Close) candlestick data for charting and technical analysis.

| Field | Value |
|-------|-------|
| API | `GET /{channel}/history` (History API) |
| Auth | None |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbol` | string | Yes | Trading pair (e.g. "BTC/USD") |
| `resolution` | string | Yes | Candle size: `1`, `5`, `15`, `30`, `60`, `240`, `D`, `W`, `M` |
| `from` | number | Yes | Start time (Unix seconds) |
| `to` | number | Yes | End time (Unix seconds) |
| `channel` | string | No | Override default channel |

**Returns:** `{ s: "ok", t: [timestamps], o: [opens], h: [highs], l: [lows], c: [closes], v: [volumes] }`

**LLM description:** *"Fetch OHLC candlestick data for a symbol. Use for charting, technical analysis, backtesting. Resolutions: 1/5/15/30/60 minutes, 240 (4h), D (daily), W (weekly), M (monthly). Timestamps are Unix seconds."*

---

#### 3. `get_historical_price`
> Get historical price data at a specific timestamp.

| Field | Value |
|-------|-------|
| API | `GET /{channel}/price` (History API) |
| Auth | None |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids` | number[] | No* | Price feed IDs |
| `symbols` | string[] | No* | Symbol names (e.g. ["BTC/USD"]) — resolved to IDs internally |
| `timestamp` | number | Yes | Unix timestamp in **seconds or milliseconds** (auto-detected by magnitude; converted to microseconds internally) |
| `channel` | string | No | Override default channel |

*At least one of `ids` or `symbols` required.

**Returns:** All fields from the API response for each feed (e.g. `price_feed_id`, `publish_time`, `channel`, `price`, `best_bid_price`, `best_ask_price`, `confidence`, `exponent`, `publisher_count`, and any additional fields present).

**LLM description:** *"Get price data for specific feeds at a historical timestamp. Use get_symbols first to find feed IDs or symbols. Accepts Unix seconds or milliseconds (auto-detected). Prices are integers with an exponent field — human-readable price = price * 10^exponent."*

---

### Toolset: `prices` (requires Pro token)

#### 4. `get_latest_price`
> Get the most recent real-time price data for one or more feeds.

| Field | Value |
|-------|-------|
| API | `POST /v1/latest_price` (Router API) |
| Auth | **Required** (Bearer token) |
| Read-only | Yes |

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbols` | string[] | No* | Symbol names (e.g. ["BTC/USD", "ETH/USD"]) |
| `priceFeedIds` | number[] | No* | Numeric feed IDs |
| `properties` | string[] | No | Properties to return. Default: `[price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount]` |
| `channel` | string | No | Override default channel |

*At least one of `symbols` or `priceFeedIds` required.

**Returns:** Full `parsed` response payload (all fields included). Binary signed payload fields (`evm`, `solana`, `leUnsigned`, `leSigned`) are excluded. Includes `timestampUs`, `priceFeeds` with all available properties per feed.

**Error when no token:** `"This tool requires a Pyth Pro access token. Set PYTH_PRO_ACCESS_TOKEN or get one at https://pyth.network/pricing"`

---

## Resources (9 resources)

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
| `pyth://feeds` | Full feed catalog (all asset types) | `GET /symbols` (History API), cached 1 day |
| `pyth://feeds/{asset_type}` | Feeds filtered by asset type (template) | `GET /symbols?asset_type={asset_type}`, cached 1 day |
| `pyth://tradingview/config` | TradingView-compatible configuration (supported resolutions, capabilities) | `GET /{channel}/config` (History API) |

---

## Prompts (3 starters)

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
| Missing token | — | Return tool error | "This tool requires a Pyth Pro access token. Set PYTH_PRO_ACCESS_TOKEN environment variable. Get a token at https://pyth.network/pricing" |
| Invalid token | 403 | Return tool error | "Your Pyth Pro access token is invalid or expired. Check your PYTH_PRO_ACCESS_TOKEN value." |
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
@pyth-network/mcp-server/
├── src/
│   ├── index.ts                  # CLI entry point (stdio + http commands)
│   ├── server.ts                 # MCP server creation, middleware, registration
│   ├── config.ts                 # Configuration (env vars, CLI flags, defaults)
│   │
│   ├── clients/
│   │   ├── router.ts             # Pyth Pro Router API client (POST /v1/*)
│   │   ├── history.ts            # Pyth Pro History API client (GET /*)
│   │   └── types.ts              # Shared API response types
│   │
│   ├── tools/
│   │   ├── index.ts              # Tool registry — exports all tools
│   │   ├── get-symbols.ts        # get_symbols (History: GET /symbols)
│   │   ├── get-candlestick-data.ts        # get_candlestick_data (History: GET /{channel}/history)
│   │   ├── get-historical-price.ts          # get_historical_price (History: GET /{channel}/price)
│   │   └── get-latest-price.ts   # get_latest_price (Router: POST /v1/latest_price)
│   │
│   ├── resources/
│   │   ├── index.ts              # Resource registry
│   │   ├── feeds.ts              # pyth://feeds, pyth://feeds/{asset_type}
│   │   ├── schema.ts             # pyth://schema/* (streaming_payload, errors, openapi)
│   │   ├── docs.ts               # pyth://docs/* (integration guide, chains)
│   │   └── tradingview.ts        # pyth://tradingview/config
│   │
│   ├── prompts/
│   │   ├── index.ts              # Prompt registry
│   │   ├── market-snapshot.ts
│   │   ├── price-analysis.ts
│   │   └── setup-pyth-pro.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts               # Token extraction + validation
│   │   └── logging.ts            # Structured invocation logging
│   │
│   └── utils/
│       ├── errors.ts             # Error types (PythAPIError, PythAuthError, etc.)
│       ├── channel.ts            # Channel resolution (default + override + feed min)
│       └── logger.ts             # Structured JSON logger
│
├── content/
│   ├── integration-guide.md      # Static content for pyth://docs/integration-guide
│   ├── chains.md                 # Static content for pyth://docs/chains
│   ├── streaming-payload-schema.md         # Static content for pyth://schema/streaming_payload
│   └── error-codes.md            # Static content for pyth://schema/errors
│
├── tests/
│   ├── tools/                    # Unit tests per tool
│   ├── clients/                  # API client tests with mocked HTTP
│   ├── resources/                # Resource handler tests
│   └── e2e/                      # E2E tests with real API (optional token)
│
├── package.json
├── tsconfig.json
├── .env.example                  # PYTH_PRO_ACCESS_TOKEN=your_token_here
└── README.md
```

---

## Configuration

| Env Var | CLI Flag | Default | Description |
|---------|----------|---------|-------------|
| `PYTH_PRO_ACCESS_TOKEN` | `--token` | — | Pyth Pro bearer token. Required for Router API tools. |
| `PYTH_CHANNEL` | `--channel` | `fixed_rate@200ms` | Default price channel |
| `PYTH_ROUTER_URL` | `--router-url` | `https://pyth-lazer.dourolabs.app` | Router API base URL |
| `PYTH_HISTORY_URL` | `--history-url` | `https://history.pyth-lazer.dourolabs.app` | History API base URL |
| `PYTH_LOG_LEVEL` | `--log-level` | `info` | Log level: debug, info, warn, error |
| `PYTH_LOG_FILE` | `--log-file` | stderr | Log output file (stdio mode logs to stderr to avoid polluting JSON-RPC) |
| `PYTH_REQUEST_TIMEOUT_MS` | `--timeout` | `10000` | HTTP request timeout in milliseconds |
| `PORT` | `--port` | `8080` | HTTP server port |

**CLI commands:**
```bash
# Stdio mode (for Claude Desktop, Cursor, etc.)
npx @pyth-network/mcp-server stdio

# HTTP mode (for remote deployment)
npx @pyth-network/mcp-server http --port 8080
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

## v2 — Shared Trial Token (Summary)

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
# 1. Install and run
PYTH_PRO_ACCESS_TOKEN=your_token npx @pyth-network/mcp-server stdio

# 2. In Claude Desktop config, add:
{
  "mcpServers": {
    "pyth-pro": {
      "command": "npx",
      "args": ["@pyth-network/mcp-server", "stdio"],
      "env": { "PYTH_PRO_ACCESS_TOKEN": "your_token" }
    }
  }
}

# 3. Test queries:
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
| 4 | Auth v1 | Env var / Config file / OAuth | **Env var only** (`PYTH_PRO_ACCESS_TOKEN`) | Simplest model. Matches GitHub MCP server pattern. Config file adds complexity without v1 value. |
| 5 | Auth v2 | Shared server token with rate limiting | **Planned** | Server holds `PYTH_PRO_SERVER_TOKEN`, rate-limited per session, never exposed. Enables trial usage. |
| 6 | Graceful degradation | Always require token / Graceful / Separate toolsets | **Graceful degradation** | History API is public — no reason to block symbol search and OHLC. Creates natural adoption funnel to Pro. |
| 7 | Feed identifiers | Symbols only / IDs only / Both | **Both** | LLMs naturally use symbols ("BTC/USD"). Power users and code may use numeric IDs. Accept both. |
| 8 | Channel default | Server-wide only / Per-tool only / Both | **Server-wide default + per-tool override** | Most feeds are 200ms. Default covers 90% of cases. Override for feeds supporting real_time. |
| 9 | Properties | Explicit selection / Return all / Sensible defaults | **Sensible defaults** | `[price, bestBidPrice, bestAskPrice, confidence, exponent, publisherCount]` covers most use cases. Override available. |
| 10 | TradingView endpoints | Skip / Resource only / Tools | **Resource only** | TradingView compat is for chart widgets, not LLM interactions. Expose config as resource for developers. |
| 11 | Code Mode | v1 / v1.1 / v2 | **v1.1 fast-follow** | Hybrid approach: standard MCP tools in v1, `execute_analysis` sandbox tool in v1.1. Ship tools first, add code execution once tool usage patterns are understood. |
| 12 | Code sandbox runtime | Cloudflare Workers / isolated-vm / quickjs | **isolated-vm** (v1.1) | V8 isolate in Node.js. Works anywhere (not CF-locked). Memory/CPU isolation. Well-maintained. |
| 13 | Prompts | Defer to v2 / Include 2-3 starters | **Include 3 starters** | `market_snapshot`, `price_analysis`, `setup_pyth_pro`. Low effort, high demo value for generating Pro leads. |
| 14 | Hosting | Cloudflare Workers / Docker / Decide later | **Decide later** | Focus on stdio for v1 launch. HTTP mode built and tested but hosting infrastructure deferred. |
| 15 | Observability | Minimal / Analytics / Full | **Full observability** | 20+ fields per invocation. Structured JSON logs for Grafana/Loki. Tracks usage analytics + operational health. |
| 16 | Package name | @pyth-network/mcp-server / pyth-pro-mcp-server | **@pyth-network/mcp-server** | Scoped under Pyth npm org. Clean, professional, discoverable. |

