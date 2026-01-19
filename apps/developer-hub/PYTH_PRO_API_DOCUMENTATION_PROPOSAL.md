# Pyth Pro API Documentation Improvement Proposal

## Executive Summary

This document provides a comprehensive evaluation of the current Pyth Pro API documentation and proposes improvements based on industry best practices from:
- **Diátaxis Framework** - Documentation taxonomy and structure
- **idratherbewriting (API Documentation Guide)** - API-specific best practices
- **Google Technical Writing** - Clarity and accessibility
- **Write the Docs** - User-centered documentation philosophy

---

## Part 1: Current State Evaluation

### What Exists Today

| Document | Type (Diátaxis) | Quality Score | Notes |
|----------|-----------------|---------------|-------|
| `getting-started.mdx` | Tutorial | ★★★★☆ | Good hands-on guide, but could include more context |
| `subscribe-to-prices.mdx` | How-To | ★★★★☆ | Clear steps, good code examples |
| `payload-reference.mdx` | Reference | ★★★★☆ | Comprehensive, well-structured tables |
| `how-lazer-works.mdx` | Explanation | ★★★☆☆ | Good architecture overview, lacks depth |
| `understanding-price-data.mdx` | Explanation | ★★★☆☆ | Covers concepts but needs expansion |
| REST API Docs | Reference | ★★☆☆☆ | External link only, not integrated |
| History Service | Reference | ★☆☆☆☆ | Barely documented |
| WebSocket API | Reference | ★★☆☆☆ | External link only, not self-contained |

### Strengths of Current Documentation

1. **Clear getting started flow** - Step-by-step with runnable examples
2. **Good code examples** - Real, copy-pasteable TypeScript/JavaScript
3. **Comprehensive payload reference** - Detailed field specifications
4. **Proper callouts** - Warnings about security, important notes
5. **SDK integration** - Direct integration with `@pythnetwork/pyth-lazer-sdk`

### Critical Gaps Identified

#### Gap 1: Missing Self-Contained API Reference
- WebSocket API reference links to external `https://pyth-lazer.dourolabs.app/docs`
- REST endpoints not documented in main docs
- History Service API undocumented
- No OpenAPI/Swagger integration for Pyth Pro (unlike Hermes)

#### Gap 2: Incomplete Service Coverage
- **History Service**: Only mentioned in architecture diagram, no API docs
- **REST Endpoint** (`/v1/latest_price`): Mentioned but not documented
- **OHLC API**: Mentioned but no reference documentation

#### Gap 3: Missing Error Documentation
- No error codes reference
- No troubleshooting guide
- No status codes for WebSocket/REST responses

#### Gap 4: No Rate Limiting Documentation
- Rate limits mentioned but not specified
- No guidance on handling rate limit errors

#### Gap 5: Authentication Could Be Clearer
- Token acquisition process documented
- Missing: token scopes, expiration, refresh flows, error handling

---

## Part 2: Proposed Documentation Structure

### Diátaxis-Based Information Architecture

```
pyth-pro/
├── 📚 TUTORIALS (Learning-oriented)
│   ├── getting-started.mdx                    # ✅ EXISTS - Enhance
│   ├── build-your-first-price-display.mdx     # 🆕 NEW
│   └── deploy-to-production.mdx               # 🆕 NEW
│
├── 📋 HOW-TO GUIDES (Task-oriented)
│   ├── acquire-access-token.mdx               # ✅ EXISTS
│   ├── subscribe-to-prices.mdx                # ✅ EXISTS - Enhance
│   ├── fetch-historical-prices.mdx            # 🆕 NEW
│   ├── handle-connection-errors.mdx           # 🆕 NEW
│   ├── implement-redundancy.mdx               # 🆕 NEW
│   └── integrate-as-consumer/                 # ✅ EXISTS
│       ├── index.mdx
│       ├── svm.mdx
│       └── evm.mdx
│
├── 📖 REFERENCE (Information-oriented)
│   ├── api/
│   │   ├── websocket-api.mdx                  # 🆕 NEW (self-contained)
│   │   ├── rest-api.mdx                       # 🆕 NEW
│   │   └── history-api.mdx                    # 🆕 NEW
│   ├── payload-reference.mdx                  # ✅ EXISTS
│   ├── price-feed-ids.mdx                     # ✅ EXISTS
│   ├── contract-addresses.mdx                 # ✅ EXISTS
│   ├── error-codes.mdx                        # 🆕 NEW
│   ├── rate-limits.mdx                        # 🆕 NEW
│   └── market-hours.mdx                       # ✅ EXISTS
│
└── 💡 EXPLANATION (Understanding-oriented)
    ├── how-lazer-works.mdx                    # ✅ EXISTS - Enhance
    ├── understanding-price-data.mdx           # ✅ EXISTS
    ├── security-model.mdx                     # 🆕 NEW
    └── data-freshness-guarantees.mdx          # 🆕 NEW
```

---

## Part 3: API Reference Documentation Standards

Based on **idratherbewriting** best practices, each API endpoint should include these 5 essential elements:

### Template: REST Endpoint Documentation

```markdown
---
title: [Endpoint Name]
description: [One-line description]
---

## Overview

[2-3 sentence description of what this endpoint does and when to use it]

## Endpoint

| Property | Value |
|----------|-------|
| **URL** | `GET /v1/latest_price` |
| **Authentication** | Bearer Token (required) |
| **Rate Limit** | 100 requests/second |

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token: `Bearer {your_token}` |
| `Content-Type` | No | `application/json` |

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `price_feed_ids` | `array[number]` | Yes | List of price feed IDs | `[1, 2, 3]` |
| `parsed` | `boolean` | No | Include parsed response | `true` |

### Request Example

```bash
curl -X GET "https://pyth-lazer.dourolabs.app/v1/latest_price?price_feed_ids=1,2" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

```typescript
const response = await fetch(
  "https://pyth-lazer.dourolabs.app/v1/latest_price?price_feed_ids=1,2",
  {
    headers: {
      Authorization: `Bearer ${YOUR_TOKEN}`,
    },
  }
);
```

## Response

### Success Response (200 OK)

```json
{
  "timestampUs": "1730986152400000",
  "priceFeeds": [
    {
      "priceFeedId": 1,
      "price": "1006900000000",
      "exponent": -8
    }
  ]
}
```

### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `timestampUs` | `string` | Unix timestamp in microseconds |
| `priceFeeds` | `array[PriceFeed]` | Array of price feed data |
| `priceFeeds[].priceFeedId` | `number` | Unique price feed identifier |
| `priceFeeds[].price` | `string` | Price mantissa (multiply by 10^exponent) |
| `priceFeeds[].exponent` | `number` | Decimal exponent (typically -8) |

### Error Responses

| Code | Description | Example |
|------|-------------|---------|
| `400` | Invalid request parameters | `{"error": "Invalid price_feed_ids"}` |
| `401` | Unauthorized - Invalid/missing token | `{"error": "Unauthorized"}` |
| `429` | Rate limit exceeded | `{"error": "Too many requests"}` |
| `500` | Internal server error | `{"error": "Internal error"}` |

## Notes

- Prices are returned as mantissa values. Calculate actual price: `price * 10^exponent`
- For real-time streaming, use the WebSocket API instead
```

### Template: WebSocket API Documentation

```markdown
---
title: WebSocket API Reference
description: Real-time price streaming via WebSocket
---

## Overview

The Pyth Pro WebSocket API provides real-time streaming price updates with sub-millisecond latency.

## Connection

### Endpoints

| Endpoint | Region | Status |
|----------|--------|--------|
| `wss://pyth-lazer-0.dourolabs.app/v1/stream` | Primary | Active |
| `wss://pyth-lazer-1.dourolabs.app/v1/stream` | Secondary | Active |
| `wss://pyth-lazer-2.dourolabs.app/v1/stream` | Tertiary | Active |

> **Important**: Connect to ALL endpoints for redundancy during deployments.

### Authentication

Include your access token as a Bearer token in the connection headers:

```typescript
const ws = new WebSocket("wss://pyth-lazer-0.dourolabs.app/v1/stream", {
  headers: {
    Authorization: `Bearer ${YOUR_TOKEN}`,
  },
});
```

## Messages

### Client → Server Messages

#### Subscribe Message

Request a price feed subscription.

```json
{
  "type": "subscribe",
  "subscriptionId": 1,
  "priceFeedIds": [1, 2],
  "properties": ["price", "confidence", "bestBidPrice", "bestAskPrice"],
  "chains": ["solana", "evm"],
  "channel": "fixed_rate@200ms",
  "parsed": true,
  "jsonBinaryEncoding": "hex"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Must be `"subscribe"` |
| `subscriptionId` | `number` | Yes | Your unique subscription ID |
| `priceFeedIds` | `array[number]` | Yes | Price feed IDs to subscribe to |
| `properties` | `array[string]` | Yes | Properties to include in updates |
| `chains` | `array[string]` | No | Blockchain formats for signed payloads |
| `channel` | `string` | No | Update frequency channel |
| `parsed` | `boolean` | No | Include human-readable parsed data |
| `jsonBinaryEncoding` | `string` | No | Encoding for binary data (`"hex"` or `"base64"`) |

**Available Properties:**
- `price` - Aggregate price
- `confidence` - Price confidence interval
- `bestBidPrice` - Highest bid price
- `bestAskPrice` - Lowest ask price
- `publisherCount` - Number of contributing publishers
- `exponent` - Decimal exponent
- `marketSession` - Trading session status
- `fundingRate` - Funding rate (derivatives only)

**Available Channels:**
| Channel | Description |
|---------|-------------|
| `real_time` | Updates as fast as available (1-50ms) |
| `fixed_rate@1ms` | Updates every 1ms |
| `fixed_rate@50ms` | Updates every 50ms |
| `fixed_rate@200ms` | Updates every 200ms |
| `fixed_rate@1000ms` | Updates every 1 second |

#### Unsubscribe Message

```json
{
  "type": "unsubscribe",
  "subscriptionId": 1
}
```

### Server → Client Messages

#### StreamUpdated Message

Price update containing requested data and signed payloads.

```json
{
  "type": "streamUpdated",
  "subscriptionId": 1,
  "parsed": {
    "timestampUs": "1730986152400000",
    "priceFeeds": [
      {
        "priceFeedId": 1,
        "price": "1006900000000",
        "confidence": 1373488286,
        "bestBidPrice": "1006850000000",
        "bestAskPrice": "1006950000000",
        "exponent": -8,
        "publisherCount": 9,
        "marketSession": "regular"
      }
    ]
  },
  "solana": {
    "encoding": "hex",
    "data": "b9011a82..."
  },
  "evm": {
    "encoding": "hex",
    "data": "a7012b93..."
  }
}
```

#### Error Message

```json
{
  "type": "error",
  "code": "INVALID_SUBSCRIPTION",
  "message": "Subscription ID 1 not found"
}
```

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `UNAUTHORIZED` | Invalid or expired token | Refresh token and reconnect |
| `INVALID_SUBSCRIPTION` | Invalid subscription parameters | Check request format |
| `RATE_LIMITED` | Too many subscriptions/requests | Reduce subscription frequency |
| `INTERNAL_ERROR` | Server error | Retry with exponential backoff |

## Connection Lifecycle

1. **Connect** with Authorization header
2. **Send** subscribe message(s)
3. **Receive** streamUpdated messages
4. **Handle** disconnections with automatic reconnection
5. **Unsubscribe** when done

## Best Practices

1. **Always connect to all 3 endpoints** for redundancy
2. **Implement automatic reconnection** with exponential backoff
3. **Use the SDK** (`@pythnetwork/pyth-lazer-sdk`) for built-in best practices
4. **Request only needed properties** to minimize bandwidth
5. **Choose appropriate channel** for your latency requirements
```

---

## Part 4: Specific Service Documentation Requirements

### 4.1 WebSocket API (Partially Documented)

**Current State**: Documented in `subscribe-to-prices.mdx` but reference links externally.

**Required Additions**:
1. Self-contained API reference (see template above)
2. Complete message schema documentation
3. Error codes and handling
4. Connection lifecycle documentation
5. Reconnection strategies

### 4.2 REST API (Undocumented)

**Endpoint**: `GET /v1/latest_price`

**Required Documentation**:
```
rest-api.mdx
├── Overview
├── Base URL
├── Authentication
├── Endpoints
│   └── GET /v1/latest_price
│       ├── Description
│       ├── Request parameters
│       ├── Request examples (curl, TypeScript, Python)
│       ├── Response schema
│       ├── Response examples
│       └── Error responses
├── Rate Limits
└── Error Codes
```

### 4.3 History Service (Undocumented)

**Endpoints** (based on architecture document):
- `GET /history/v1/symbols` - List available symbols
- `GET /history/v1/ohlc` - OHLC candlestick data
- Historical price queries

**Required Documentation**:
```
history-api.mdx
├── Overview
├── Base URL: https://history.pyth-lazer.dourolabs.app
├── Authentication (if required)
├── Endpoints
│   ├── GET /history/v1/symbols
│   │   ├── Description: List all available price feed symbols
│   │   ├── Request: No parameters
│   │   ├── Response: Array of symbol objects
│   │   └── Example
│   ├── GET /history/v1/ohlc
│   │   ├── Description: Get OHLC candlestick data
│   │   ├── Parameters: symbol, resolution, from, to
│   │   ├── Response: OHLC data array
│   │   └── Example
│   └── GET /history/v1/prices
│       ├── Description: Get historical prices
│       ├── Parameters: symbol, from, to, resolution
│       ├── Response: Price history array
│       └── Example
├── Data Formats
├── Rate Limits
└── Error Codes
```

---

## Part 5: New Documentation to Create

### 5.1 Error Codes Reference (`error-codes.mdx`)

```markdown
---
title: Error Codes
description: Complete reference of Pyth Pro error codes and troubleshooting
---

## WebSocket Error Codes

| Code | Message | Cause | Resolution |
|------|---------|-------|------------|
| `1000` | Normal closure | Client initiated close | N/A |
| `1001` | Going away | Server shutting down | Reconnect to another endpoint |
| `1008` | Policy violation | Invalid token | Refresh authentication |
| `4001` | Unauthorized | Missing/expired token | Obtain new token |
| `4002` | Invalid subscription | Malformed subscription | Check message format |
| `4003` | Rate limited | Too many requests | Implement backoff |
| `4004` | Invalid price feed | Unknown price feed ID | Check price-feed-ids list |

## REST API Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| `400` | `INVALID_REQUEST` | Malformed request |
| `401` | `UNAUTHORIZED` | Invalid authentication |
| `403` | `FORBIDDEN` | Insufficient permissions |
| `404` | `NOT_FOUND` | Resource not found |
| `429` | `RATE_LIMITED` | Rate limit exceeded |
| `500` | `INTERNAL_ERROR` | Server error |

## Troubleshooting

### Connection Issues
[Common issues and solutions]

### Authentication Issues
[Token problems and solutions]

### Data Issues
[Missing prices, stale data, etc.]
```

### 5.2 Rate Limits Reference (`rate-limits.mdx`)

```markdown
---
title: Rate Limits
description: Pyth Pro rate limiting policies and best practices
---

## WebSocket Rate Limits

| Limit Type | Value | Scope |
|------------|-------|-------|
| Connections per token | 10 | Per access token |
| Subscriptions per connection | 100 | Per WebSocket connection |
| Subscribe messages per minute | 60 | Per connection |

## REST API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/v1/latest_price` | 100 req/s | Per token |
| History endpoints | 60 req/min | Per token |

## Handling Rate Limits

### Response Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

### Best Practices
1. Monitor rate limit headers
2. Implement exponential backoff
3. Cache responses when appropriate
4. Use WebSocket for real-time needs instead of polling REST
```

### 5.3 Handle Connection Errors (`handle-connection-errors.mdx`)

```markdown
---
title: Handle Connection Errors
description: Implement robust error handling for Pyth Pro connections
---

## Overview

This guide shows how to implement production-grade error handling for Pyth Pro.

## Reconnection Strategy

```typescript
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

const ENDPOINTS = [
  "wss://pyth-lazer-0.dourolabs.app/v1/stream",
  "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  "wss://pyth-lazer-2.dourolabs.app/v1/stream",
];

async function createRobustClient(token: string) {
  const client = await PythLazerClient.create(ENDPOINTS, token, {
    onError: (error) => {
      console.error("Connection error:", error);
      // Implement your alerting logic
    },
    onReconnect: () => {
      console.log("Reconnected successfully");
      // Re-subscribe to feeds
    },
  });

  return client;
}
```

## Error Types and Handling

| Error Type | Retry? | Strategy |
|------------|--------|----------|
| Network timeout | Yes | Exponential backoff |
| Authentication failure | No | Refresh token first |
| Rate limit | Yes | Wait for reset window |
| Invalid subscription | No | Fix request parameters |
| Server error | Yes | Try different endpoint |

[Continue with detailed examples...]
```

---

## Part 6: Enhanced Existing Documentation

### 6.1 Getting Started Enhancement

**Add to `getting-started.mdx`:**

```markdown
## Before You Begin

Before diving into the code, it helps to understand:
- [How Pyth Pro Works](/price-feeds/pro/how-lazer-works) - Architecture overview
- [Understanding Price Data](/price-feeds/pro/understanding-price-data) - What the data means

## Troubleshooting

### Common Issues

**"Unauthorized" error**
- Ensure your token is valid and not expired
- Check that you're using the correct token format: `Bearer YOUR_TOKEN`

**No data received**
- Verify price feed IDs are valid (see [Price Feed IDs](/price-feeds/pro/price-feed-ids))
- Check your subscription parameters

**Connection drops**
- Connect to all 3 endpoints for redundancy
- Implement automatic reconnection (see [Handle Connection Errors](/price-feeds/pro/handle-connection-errors))
```

### 6.2 How Pyth Pro Works Enhancement

**Add to `how-lazer-works.mdx`:**

```markdown
## API Access Points

| Service | Endpoint | Use Case |
|---------|----------|----------|
| WebSocket Streaming | `wss://pyth-lazer-{0,1,2}.dourolabs.app/v1/stream` | Real-time price updates |
| REST API | `https://pyth-lazer.dourolabs.app/v1/latest_price` | On-demand price queries |
| History Service | `https://history.pyth-lazer.dourolabs.app` | Historical data & OHLC |
| Symbols API | `https://history.pyth-lazer.dourolabs.app/history/v1/symbols` | Available feeds list |

## Data Flow Diagram

[Add sequence diagram showing request flow through services]

## Latency Characteristics

| Path | Typical Latency |
|------|-----------------|
| Publisher → Router | < 10ms |
| Router → Consumer (WebSocket) | < 1ms |
| End-to-end (Publisher → Consumer) | < 50ms |
```

---

## Part 7: Implementation Checklist

### Phase 1: Critical Gaps (High Priority)
- [ ] Create self-contained WebSocket API reference
- [ ] Create REST API reference documentation
- [ ] Create History Service API reference
- [ ] Add error codes reference
- [ ] Add rate limits documentation

### Phase 2: Enhanced Guides (Medium Priority)
- [ ] Add troubleshooting to getting started
- [ ] Create connection error handling guide
- [ ] Create redundancy implementation guide
- [ ] Enhance architecture documentation with API details

### Phase 3: Advanced Content (Lower Priority)
- [ ] Create production deployment tutorial
- [ ] Add security model explanation
- [ ] Create data freshness guarantees documentation
- [ ] Add migration guide from other price feed services

### Phase 4: OpenAPI Integration
- [ ] Create/obtain OpenAPI spec for Pyth Pro REST endpoints
- [ ] Create OpenAPI spec for History Service
- [ ] Integrate with Fumadocs OpenAPI plugin (like Hermes)
- [ ] Generate interactive API explorer

---

## Part 8: Documentation Quality Standards

### Content Standards

1. **Every endpoint must have**:
   - Description (what and why)
   - Authentication requirements
   - Request parameters with types
   - Request example (multiple languages)
   - Response schema with types
   - Response example
   - Error responses

2. **Every guide must have**:
   - Prerequisites
   - Step-by-step instructions
   - Working code examples
   - Expected output
   - Troubleshooting section
   - Next steps

3. **Code examples must**:
   - Be copy-paste ready
   - Include necessary imports
   - Handle errors appropriately
   - Use realistic values (not `YOUR_TOKEN` everywhere)
   - Work with the latest SDK version

### Style Standards

1. **Use active voice**: "Send a subscribe message" not "A subscribe message should be sent"
2. **Be concise**: Remove filler words
3. **Use consistent terminology**: "price feed" not "price stream" or "data feed"
4. **Format consistently**: Use tables for parameters, code blocks for examples
5. **Link related content**: Every page should link to relevant reference/guides

---

## Appendix: Meta.json Structure Update

Update `/content/docs/price-feeds/pro/meta.json`:

```json
{
  "pages": [
    "---Getting Started---",
    "getting-started",
    "---How-To Guides---",
    "acquire-access-token",
    "subscribe-to-prices",
    "fetch-historical-prices",
    "handle-connection-errors",
    "implement-redundancy",
    "integrate-as-consumer",
    "---API Reference---",
    "api/websocket-api",
    "api/rest-api",
    "api/history-api",
    "error-codes",
    "rate-limits",
    "payload-reference",
    "price-feed-ids",
    "contract-addresses",
    "market-hours",
    "---Understanding Pyth Pro---",
    "how-lazer-works",
    "understanding-price-data",
    "security-model",
    "data-freshness-guarantees"
  ]
}
```

---

## Summary

This proposal restructures Pyth Pro documentation following the Diátaxis framework and API documentation best practices. The key improvements are:

1. **Self-contained API references** - No more external links for core API docs
2. **Complete service coverage** - WebSocket, REST, and History APIs documented
3. **Error and troubleshooting docs** - Help users debug issues
4. **Consistent structure** - Every endpoint follows the same template
5. **Better discoverability** - Clear navigation between tutorials, how-tos, and reference

The result will be documentation that serves developers at every stage: from first exploration (tutorials) through daily use (reference) to debugging (error codes and troubleshooting).
