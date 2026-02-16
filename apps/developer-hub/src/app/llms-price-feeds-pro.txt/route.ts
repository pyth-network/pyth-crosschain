import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# Pyth Pro — Quick Start

> Enterprise-grade, ultra-low latency WebSocket price streaming for professional trading applications.
> This file contains a curated quick-start. For full docs, fetch individual pages below.

## Overview

Pyth Pro (formerly Lazer) is a subscription-based price streaming service designed for high-frequency trading, MEV strategies, and latency-sensitive applications. It delivers real-time market data via WebSocket with configurable update channels.

Unlike Pyth Core (pull-based oracle for DeFi), Pyth Pro provides direct WebSocket streaming optimized for speed. Data can optionally be verified on-chain using signed payloads on EVM and Solana.

Access requires an API token from an authorized Pyth Data Distributor. Apply at https://pyth.network/pro.

## Key Concepts

**WebSocket Streaming**: Connect to redundant WebSocket endpoints for continuous price delivery. You must connect to all three endpoints simultaneously for reliability.

**Channels**: Control update frequency per subscription:
- \`real_time\` — Updates as soon as available (1–50ms)
- \`fixed_rate@200ms\` — Updates every 200ms (most common)
- \`fixed_rate@50ms\` — Updates every 50ms
- \`fixed_rate@1ms\` — Updates every 1ms (ultra-low latency)
- \`fixed_rate@1000ms\` — Updates every 1 second

**Access Tokens**: Required for authentication. Pass as \`Authorization: Bearer {token}\` header. Tokens are permissioned for specific asset types and minimum channel rates. Never expose tokens in frontend code.

**Price Feed IDs**: Pro uses numeric IDs (not hex strings). BTC/USD = 1, ETH/USD = 2, SOL/USD = 5.

**Binary Formats**: Payloads can include signed data for on-chain verification:
- \`evm\` — ECDSA signatures for EVM chains
- \`solana\` — Ed25519 signatures for Solana/Fogo
- \`leUnsigned\` — No signature (offline/testing only)

## Integration Code

### TypeScript (WebSocket Client)

\`\`\`typescript
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

const client = await PythLazerClient.create({
  urls: [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
    "wss://pyth-lazer-2.dourolabs.app/v1/stream",
  ],
  token: process.env.ACCESS_TOKEN,
});

client.addMessageListener((message) => {
  if (message.type === "streamUpdated") {
    for (const feed of message.parsed.priceFeeds) {
      console.log(feed.priceFeedId, feed.price, feed.confidence);
    }
  }
});

client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: [1, 2],       // BTC/USD, ETH/USD
  properties: ["price"],
  formats: ["evm"],            // Include EVM-signed payloads
  deliveryFormat: "json",
  channel: "fixed_rate@200ms",
  jsonBinaryEncoding: "hex",
});
\`\`\`

Install: \`npm install @pythnetwork/pyth-lazer-sdk\`

### On-Chain Verification (EVM / Solidity)

\`\`\`solidity
import { PythLazer } from "pyth-lazer-sdk/PythLazer.sol";
import { PythLazerLib } from "pyth-lazer-sdk/PythLazerLib.sol";

contract MyContract {
    PythLazer pythLazer;

    function verifyPrice(bytes calldata payload) external payable {
        // Verify signature and parse payload
        (bytes memory verified, uint fee) = pythLazer.verifyUpdate(payload);
        // Parse header and feed data from verified bytes
        // See full guide: docs.pyth.network/price-feeds/pro/integrate-as-consumer/evm.mdx
    }
}
\`\`\`

EVM SDK: Add via git submodule from \`pyth-network/pyth-crosschain/lazer/contracts/evm\`

### Response Message Structure

\`\`\`json
{
  "type": "streamUpdated",
  "subscriptionId": 1,
  "parsed": {
    "timestampUs": "1758690761750000",
    "priceFeeds": [
      {
        "priceFeedId": 1,
        "price": "11223872331053",
        "exponent": -8,
        "confidence": 1373488286,
        "bestBidPrice": "11222498842767",
        "bestAskPrice": "11224513591935",
        "publisherCount": 9,
        "marketSession": "regular"
      }
    ]
  },
  "evm": { "encoding": "hex", "data": "0x..." }
}
\`\`\`

Price calculation: \`actual_price = price * 10^exponent\`

## WebSocket Endpoints (Redundancy Required)

You MUST connect to all three endpoints simultaneously. Any single endpoint may go down for deployments.
- wss://pyth-lazer-0.dourolabs.app/v1/stream
- wss://pyth-lazer-1.dourolabs.app/v1/stream
- wss://pyth-lazer-2.dourolabs.app/v1/stream

## API Services

| Service | Base URL | Purpose |
|---------|----------|---------|
| WebSocket | wss://pyth-lazer-{0,1,2}.dourolabs.app/v1/stream | Real-time price streaming |
| REST | https://pyth-lazer.dourolabs.app | Latest price and historical lookups |
| History | https://history.pyth-lazer.dourolabs.app | OHLC candlestick data, TradingView UDF |

### REST API
- POST /v1/latest_price — Fetch most recent price for requested feeds
- POST /v1/price — Fetch price at a specific historical timestamp (Unix microseconds)

### History API
- GET /{channel}/history — OHLC candlestick data
- GET /{channel}/price — Price at specific timestamp
- GET /symbols — List available symbols (no auth required)
- Supports TradingView UDF specification

## Contract Addresses

### EVM (same address on all supported networks)
- 0xACeA761c27A909d4D3895128EBe6370FDE2dF481
- Deployed on: Base, Ethereal, Polynomial, Soneium (mainnets + testnets)

### Solana
- Devnet/Testnet: pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt

### Fogo
- pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT

Full list: https://docs.pyth.network/price-feeds/pro/contract-addresses

## Common Patterns

### Redundant Connection Setup
Always connect to all three endpoints. The SDK handles deduplication internally:
\`\`\`typescript
const client = await PythLazerClient.create({
  urls: [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
    "wss://pyth-lazer-2.dourolabs.app/v1/stream",
  ],
  token: process.env.ACCESS_TOKEN,
});
\`\`\`

### Subscribe to Only What You Need
Minimize bandwidth by requesting only the properties you need:
\`\`\`typescript
client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: [1, 2],
  properties: ["price", "confidence"],  // Only these fields returned
  formats: ["evm"],
  deliveryFormat: "json",
  channel: "fixed_rate@200ms",
  jsonBinaryEncoding: "hex",
});
\`\`\`

### Market Session Filtering
Use the \`marketSession\` field to filter updates for equities that have limited trading hours. Values: \`regular\`, \`preMarket\`, \`postMarket\`, \`overNight\`, \`closed\`.

## Troubleshooting

### "Client too slow" Error
Your message processing can't keep up with the subscription rate.
**Fix**: Optimize message handling, reduce subscription rate, or split feeds across connections.

### HTTP 403 Error
Wrong endpoint, asset class restriction, or expired token.
**Fix**: Verify token permissions, check you're using the correct endpoint, contact your data distributor.

### Stale Prices (2+ seconds old)
Do not mix Pyth Core fetch methods with Pyth Pro. Connect directly to the WebSocket endpoints.
**Fix**: Ensure all three redundant endpoints are connected. Check network latency.

### Duplicate/Missing Messages
Expected behavior during endpoint failovers. The SDK deduplicates across connections.

## Deep Dive Pages

For complete documentation, fetch any page as plain markdown:
- https://docs.pyth.network/price-feeds/pro/getting-started.mdx — Step-by-step setup guide
- https://docs.pyth.network/price-feeds/pro/subscribe-to-prices.mdx — WebSocket authentication and configuration
- https://docs.pyth.network/price-feeds/pro/payload-reference.mdx — Complete payload structure and properties
- https://docs.pyth.network/price-feeds/pro/how-lazer-works.mdx — Architecture and system components
- https://docs.pyth.network/price-feeds/pro/understanding-price-data.mdx — Confidence intervals, best bid/ask
- https://docs.pyth.network/price-feeds/pro/acquire-access-token.mdx — Token acquisition and permissions
- https://docs.pyth.network/price-feeds/pro/error-codes.mdx — Error responses and handling
- https://docs.pyth.network/price-feeds/pro/faq.mdx — Common questions and solutions
- https://docs.pyth.network/price-feeds/pro/api/websocket.mdx — WebSocket API reference
- https://docs.pyth.network/price-feeds/pro/api/rest.mdx — REST API reference
- https://docs.pyth.network/price-feeds/pro/api/history.mdx — History API and OHLC data
- https://docs.pyth.network/price-feeds/pro/integrate-as-consumer/evm.mdx — EVM on-chain verification
- https://docs.pyth.network/price-feeds/pro/integrate-as-consumer/svm.mdx — Solana/Fogo on-chain verification
- https://docs.pyth.network/price-feeds/pro/contract-addresses.mdx — Deployment addresses
- https://docs.pyth.network/price-feeds/pro/price-feed-ids.mdx — Available price feeds
`;

export function GET() {
  return new NextResponse(CONTENT, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  });
}
