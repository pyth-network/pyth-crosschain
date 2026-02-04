import { NextResponse } from "next/server";

import { getLLMTextByPaths } from "../../lib/get-llm-text";

export const revalidate = false;

const STATIC_HEADER = `# Pyth Price Feeds - Complete Documentation

> Real-time, low-latency price data for DeFi and TradFi applications.
> This file contains complete Price Feeds documentation (Core + Pro). No other files need to be fetched.

Pyth Price Feeds deliver financial market data from 120+ first-party providers including major exchanges, trading firms, and market makers. Data is verifiable on 100+ blockchains.

## Products

### Pyth Core
Decentralized price feeds with deterministic on-chain delivery.
- 400ms update frequency
- 100+ blockchain support
- Pull and push update models
- 500+ price feeds

### Pyth Pro
Enterprise-grade, subscription-based price data for professional trading.
- Ultra-low latency optimized for HFT/MEV
- Customizable channels and delivery
- Direct WebSocket streaming

## Quick Start (Solidity)

\`\`\`solidity
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MyContract {
    IPyth pyth;

    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function getPrice(bytes32 priceId, bytes[] calldata priceUpdateData) public payable returns (int64) {
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        PythStructs.Price memory price = pyth.getPrice(priceId);
        return price.price;
    }
}
\`\`\`

## Quick Start (TypeScript)

\`\`\`typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network");
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const priceUpdates = await client.getLatestPriceUpdates([ETH_USD]);
console.log(priceUpdates.parsed[0].price);
\`\`\`

## Key Price Feed IDs
- BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
- ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
- SOL/USD: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
- Full list: https://pyth.network/developers/price-feed-ids

## Contract Addresses (Key Networks)

### EVM Mainnet
- Ethereum: 0x4305FB66699C3B2702D4d05CF36551390A4c69C6
- Arbitrum: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Base: 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a
- Optimism: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Polygon: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C

### Solana
- Mainnet: FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH
- Devnet: gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s

Full list: https://docs.pyth.network/price-feeds/core/contract-addresses

## APIs

### Hermes API (Price Data)
- Base URL: https://hermes.pyth.network
- GET /v2/updates/price/latest - Get latest prices
- GET /v2/updates/price/stream - SSE streaming prices
- OpenAPI spec: https://hermes.pyth.network/docs

## SDKs
- Solidity: @pythnetwork/pyth-sdk-solidity
- TypeScript: @pythnetwork/hermes-client
- Python: pythclient
- Rust: pyth-sdk-rs

---

## Detailed Documentation

`;

export async function GET() {
  const pathPrefixes = ["/price-feeds", "/api-reference/pyth-core"];

  const scanned = await getLLMTextByPaths(pathPrefixes);

  const content = [
    STATIC_HEADER,
    `Generated on: ${new Date().toISOString()}`,
    "",
    ...scanned,
  ].join("\n");

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
