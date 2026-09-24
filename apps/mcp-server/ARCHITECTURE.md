# Architecture Design Document

## Overview

The Pyth Network MCP Server is designed as a high-performance, type-safe bridge between AI systems (primarily Claude) and the Pyth Network oracle infrastructure. This document outlines the architectural decisions, patterns, and rationale.

---

## Design Principles

### 1. Zero Bloat

Every dependency must justify its inclusion. We use:
- Native `fetch` API (Node 18+) instead of axios/got
- Zod for runtime validation (necessary for untrusted API responses)
- No unnecessary abstraction layers

### 2. Type Safety

Full TypeScript with strict mode. Types are:
- Generated from API responses where possible
- Validated at runtime boundaries
- Shared between API clients and MCP handlers

### 3. Fail Fast, Fail Loud

- Comprehensive error types with actionable messages
- No silent failures
- Structured logging for debugging

### 4. Performance First

- Request coalescing for batch operations
- Intelligent caching with TTL
- Connection pooling
- Streaming support for real-time data

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Transport Layer                       │
│                  (stdio / HTTP / WebSocket)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server Core                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Tools     │  │  Resources  │  │      Prompts        │  │
│  │  Registry   │  │  Registry   │  │      Registry       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Handler Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Tool       │  │  Resource   │  │      Prompt         │  │
│  │  Handlers   │  │  Handlers   │  │      Handlers       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          └────────────────┼───────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Client Layer                        │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │    Hermes Client     │  │     Benchmarks Client        │ │
│  │  (Real-time Data)    │  │     (Historical Data)        │ │
│  └──────────┬───────────┘  └──────────────┬───────────────┘ │
└─────────────┼─────────────────────────────┼─────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────────┐  │
│  │  Cache  │  │  Retry  │  │  Rate   │  │     Logger     │  │
│  │ Manager │  │  Logic  │  │ Limiter │  │                │  │
│  └─────────┘  └─────────┘  └─────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## API Client Design

### Hermes Client

Handles real-time price data from `hermes.pyth.network`:

```typescript
interface HermesClient {
  // Price feed discovery
  getPriceFeeds(query?: PriceFeedQuery): Promise<PriceFeed[]>;

  // Real-time prices
  getLatestPrices(feedIds: string[], options?: PriceOptions): Promise<PriceUpdate[]>;

  // Historical (point-in-time)
  getPriceAtTimestamp(feedIds: string[], timestamp: number): Promise<PriceUpdate[]>;

  // TWAP
  getTwap(feedIds: string[], window: number): Promise<TwapUpdate[]>;

  // Streaming
  streamPrices(feedIds: string[]): AsyncIterable<PriceUpdate>;

  // Network health
  getPublisherStakeCaps(): Promise<PublisherStakeCaps>;
}
```

### Benchmarks Client

Handles historical data from `benchmarks.pyth.network`:

```typescript
interface BenchmarksClient {
  // Feed metadata
  getPriceFeed(id: string): Promise<PriceFeedMetadata>;
  listPriceFeeds(query?: string, assetType?: string): Promise<PriceFeedMetadata[]>;

  // Historical data
  getHistoricalPrice(feedId: string, timestamp: number): Promise<HistoricalPrice>;
  getHistoricalPrices(feedId: string, from: number, to: number, interval: number): Promise<HistoricalPrice[]>;

  // TradingView shim
  getOHLCV(symbol: string, resolution: string, from: number, to: number): Promise<OHLCV>;
}
```

---

## Tool Implementation Patterns

### Input Validation

All tool inputs are validated using Zod schemas:

```typescript
const GetLatestPriceSchema = z.object({
  feedIds: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)).min(1).max(100),
  encoding: z.enum(['hex', 'base64']).optional().default('hex'),
  parsed: z.boolean().optional().default(true),
});
```

### Response Formatting

Responses are formatted for AI consumption:

```typescript
interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: number;
    latency: number;
    cached: boolean;
  };
}
```

### Error Handling

Errors are categorized and actionable:

```typescript
enum PythErrorCode {
  INVALID_FEED_ID = 'INVALID_FEED_ID',
  FEED_NOT_FOUND = 'FEED_NOT_FOUND',
  TIMESTAMP_OUT_OF_RANGE = 'TIMESTAMP_OUT_OF_RANGE',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
}
```

---

## Caching Strategy

### Cache Levels

1. **Price Feed Cache** (1 hour TTL)
   - Feed metadata rarely changes
   - Reduces discovery latency

2. **Price Cache** (500ms TTL)
   - Short TTL for real-time accuracy
   - Coalesces rapid requests

3. **Historical Cache** (24 hour TTL)
   - Historical data is immutable
   - Aggressive caching

### Cache Implementation

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl });
  }
}
```

---

## Rate Limiting

### Adaptive Rate Limiter

Respects API limits while maximizing throughput:

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens <= 0) {
      await this.waitForToken();
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

---

## Streaming Architecture

For real-time price feeds via Server-Sent Events:

```typescript
async function* streamPrices(feedIds: string[]): AsyncIterable<PriceUpdate> {
  const url = new URL('/v2/updates/price/stream', HERMES_URL);
  feedIds.forEach(id => url.searchParams.append('ids[]', id));

  const response = await fetch(url.toString(), {
    headers: { Accept: 'text/event-stream' },
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as PriceUpdate;
      }
    }
  }
}
```

---

## Security Considerations

### Input Sanitization

- All feed IDs validated against hex pattern
- Timestamps bounded to reasonable ranges
- Query strings sanitized

### No Secrets

- No API keys required (Pyth APIs are public)
- No sensitive data stored
- Minimal attack surface

### Resource Limits

- Maximum feed IDs per request: 100
- Maximum historical range: 30 days
- Request timeout: 30 seconds

---

## Testing Strategy

### Unit Tests

- Tool input validation
- Response formatting
- Cache behavior
- Rate limiter logic

### Integration Tests

- API client against live endpoints
- End-to-end MCP flows
- Error scenarios

### Performance Tests

- Latency benchmarks
- Cache hit rates
- Memory usage under load

---

## Deployment Considerations

### Environment Modes

```typescript
type Environment = 'development' | 'production';

const config = {
  development: {
    cacheEnabled: false,
    logLevel: 'debug',
    timeout: 60000,
  },
  production: {
    cacheEnabled: true,
    logLevel: 'info',
    timeout: 30000,
  },
};
```

### Health Checks

The server exposes health information via resource:

```
pyth://server/health
```

Returns:
- Uptime
- Cache statistics
- API connectivity status
- Last successful request timestamps

---

## Future Enhancements

### Phase 2

- WebSocket transport support
- Multi-region failover
- Prometheus metrics export

### Phase 3

- On-chain data integration (EVM/SVM)
- Custom alerting rules
- Portfolio tracking tools
