import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# Pyth Core — Quick Start

> Decentralized pull-based price oracle delivering 500+ feeds with 400ms updates across 100+ chains.
> This file contains a curated quick-start. For full docs, fetch individual pages below.

## Overview

Pyth Core is a pull-based oracle providing real-time, low-latency price data from 120+ first-party publishers including major exchanges, trading firms, and market makers. Unlike push oracles, Pyth Core lets applications fetch prices on-demand, paying gas only when needed.

The pull model works in three steps: (1) fetch signed price data from the off-chain Hermes service, (2) submit it to the on-chain Pyth contract for verification, and (3) read the verified price. This happens in a single transaction.

Supported chains: EVM, Solana, Sui, Aptos, CosmWasm, NEAR, Starknet, Fuel, IOTA, TON, Stacks, and more. All 500+ feeds are available on all chains. No API key required — Pyth is fully permissionless.

## Key Concepts

**Pull Oracle Model**: Your app requests price updates from Hermes (off-chain API), submits them on-chain for verification, and reads the result — all in one transaction. Cheaper and fresher than push oracles.

**Price Structure**: Each price contains four fields:
- \`price\` (int64) — Price as integer, multiply by 10^expo for actual value
- \`conf\` (uint64) — Confidence interval (same scale as price)
- \`expo\` (int32) — Exponent, typically -8 (divide by 10^8)
- \`publishTime\` (uint) — Unix timestamp of publication

**Confidence Intervals**: Statistical range where the true price likely falls (95% coverage). Use (price - conf) for conservative valuations, (price + conf) for liability protection. Pause activity if conf/price ratio exceeds your threshold.

**Staleness**: Prices become stale if not recently updated or outside market hours. Always use \`getPriceNoOlderThan()\` with an appropriate age threshold rather than \`getPriceUnsafe()\`.

**Update Fees**: Each on-chain price update costs a small fee (typically 1 wei on EVM). Call \`getUpdateFee()\` to get the exact amount before submitting.

## Integration Code

### EVM (Solidity)

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MyContract {
    IPyth pyth;

    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function getPrice(
        bytes32 priceId,
        bytes[] calldata priceUpdateData
    ) public payable returns (int64 price, uint64 conf, int32 expo) {
        // Step 1: Pay the fee and update the price
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // Step 2: Read the price (reverts if older than 60 seconds)
        PythStructs.Price memory p = pyth.getPriceNoOlderThan(priceId, 60);
        return (p.price, p.conf, p.expo);
    }
}
\`\`\`

Install: \`npm install @pythnetwork/pyth-sdk-solidity\`

### TypeScript (Hermes Client)

\`\`\`typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network");
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

// Fetch latest price update
const priceUpdates = await client.getLatestPriceUpdates([ETH_USD]);
const parsed = priceUpdates.parsed[0];
console.log("Price:", parsed.price.price);
console.log("Confidence:", parsed.price.conf);

// The binary data to submit on-chain
const updateData = priceUpdates.binary.data;
\`\`\`

Install: \`npm install @pythnetwork/hermes-client\`

### Streaming (Server-Sent Events)

\`\`\`typescript
const eventSource = await client.getPriceUpdatesStream([ETH_USD]);
eventSource.onMessage((update) => {
  console.log("New price:", update.parsed[0].price.price);
});
// Note: SSE streams auto-close after 24 hours — implement reconnection logic
\`\`\`

## Contract Addresses

### EVM Mainnet
- Ethereum: 0x4305FB66699C3B2702D4d05CF36551390A4c69C6
- Arbitrum: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Base: 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a
- Optimism: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Polygon: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Avalanche: 0x4305FB66699C3B2702D4d05CF36551390A4c69C6
- BNB Chain: 0x4D7E825f80bDf85e913E0DD25A3ee446C0002EB0

### Solana
- Mainnet: FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH
- Devnet: gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s

Full list: https://docs.pyth.network/price-feeds/core/contract-addresses

## Popular Feed IDs

- BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
- ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
- SOL/USD: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
- USDC/USD: 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
- Full catalog: https://pyth.network/developers/price-feed-ids

## Hermes API

- Base URL: https://hermes.pyth.network
- GET /v2/updates/price/latest?ids[]=FEED_ID — Get latest prices
- GET /v2/updates/price/stream?ids[]=FEED_ID — SSE streaming prices
- OpenAPI spec: https://hermes.pyth.network/docs

## SDKs

| Language | Package | Import |
|----------|---------|--------|
| Solidity | @pythnetwork/pyth-sdk-solidity | IPyth, PythStructs |
| TypeScript | @pythnetwork/hermes-client | HermesClient |
| Python | pythclient | — |
| Rust | pyth-sdk-rs | — |

## Common Patterns

### Stale Price Handling
Always use \`getPriceNoOlderThan(priceId, maxAge)\` instead of \`getPrice()\` or \`getPriceUnsafe()\`. Recommended maxAge values:
- DeFi lending/borrowing: 60 seconds
- Derivatives/perpetuals: 10–30 seconds
- Display/analytics: 300+ seconds

### Confidence Interval Usage
For lending protocols, use conservative pricing:
- Collateral valuation: price - confidence (lower bound)
- Debt valuation: price + confidence (upper bound)
Pause activity if the confidence-to-price ratio exceeds your threshold (e.g., conf/price > 2%).

### Multi-Feed Batch Updates
Submit multiple feeds in a single \`updatePriceFeeds()\` call to save gas:
\`\`\`typescript
const ids = [ETH_USD, BTC_USD, SOL_USD];
const updates = await client.getLatestPriceUpdates(ids);
// Submit updates.binary.data on-chain — one transaction updates all feeds
\`\`\`

### Delayed Settlement for Derivatives
Separate order commitment from execution to prevent latency exploitation:
1. User commits order (no price selected yet)
2. Wait N blocks
3. Execute using price from after commitment

## Troubleshooting

### StalePrice (0x19abf40e)
Price hasn't been updated within the specified age parameter.
**Fix**: Call \`updatePriceFeeds()\` with fresh data from Hermes before reading the price.

### PriceFeedNotFound (0x14aebe68)
Price feed doesn't exist on-chain or the feed ID is wrong.
**Fix**: Verify the price feed ID is correct. Call \`updatePriceFeeds()\` first. Verify the Pyth contract address matches the chain.

### InsufficientFee (0x025dbdd4)
Not enough native token sent for the update fee.
**Fix**: Call \`getUpdateFee(priceUpdateData)\` and pass the result as \`msg.value\`.

### Anchor Version Mismatch (Solana)
\`E0277: PriceUpdateV2: anchor_lang::AccountDeserialize not satisfied\`
**Fix**: Align anchor-lang versions between your program and pyth-solana-receiver-sdk:
\`cargo update -p anchor-lang@[SDK_VERSION] --precise [YOUR_VERSION]\`

## Deep Dive Pages

For complete documentation, fetch any page as plain markdown:
- https://docs.pyth.network/price-feeds/core/getting-started.mdx — Entry point with learning paths
- https://docs.pyth.network/price-feeds/core/best-practices.mdx — Safety patterns: staleness, confidence intervals, latency
- https://docs.pyth.network/price-feeds/core/pull-updates.mdx — How the pull oracle model works
- https://docs.pyth.network/price-feeds/core/fetch-price-updates.mdx — REST, streaming, and SDK methods
- https://docs.pyth.network/price-feeds/core/how-pyth-works/index.mdx — Architecture overview
- https://docs.pyth.network/price-feeds/core/use-real-time-data/index.mdx — Integration method selection
- https://docs.pyth.network/price-feeds/core/contract-addresses/index.mdx — Full contract address list
- https://docs.pyth.network/price-feeds/core/troubleshoot/evm.mdx — EVM error reference
- https://docs.pyth.network/price-feeds/core/troubleshoot/svm.mdx — Solana error reference
- https://docs.pyth.network/price-feeds/core/current-fees.mdx — Fee schedule by chain
- https://docs.pyth.network/price-feeds/core/price-feeds/price-feed-ids.mdx — Complete feed catalog
- https://docs.pyth.network/price-feeds/core/create-your-first-pyth-app/index.mdx — Step-by-step EVM tutorial
- https://docs.pyth.network/price-feeds/core/migrate-an-app-to-pyth/chainlink.mdx — Chainlink migration guide
`;

export function GET() {
  const content = CONTENT + `\nGenerated on: ${new Date().toISOString()}\n`;
  return new NextResponse(content, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  });
}
