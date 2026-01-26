import { NextResponse } from "next/server";

import { getLLMTextByPaths } from "../../lib/get-llm-text";

export const revalidate = false;

const STATIC_HEADER = `# Pyth Core - Complete Documentation

> Decentralized price feeds with deterministic on-chain delivery for DeFi applications.
> This file contains complete Pyth Core documentation. No other files need to be fetched.

Pyth Core provides real-time, low-latency price data from 120+ first-party publishers. It uses a pull-based oracle model where prices are fetched on-demand to minimize gas costs.

## Key Features
- **400ms update frequency** - Sub-second price updates
- **100+ blockchain support** - Deploy on any major chain
- **Pull and push models** - Flexible integration options
- **500+ price feeds** - Crypto, equities, FX, commodities
- **Confidence intervals** - Statistical uncertainty for each price

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
        // Pay the fee and update the price
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // Read the updated price
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

// Fetch price update data
const priceUpdates = await client.getLatestPriceUpdates([ETH_USD]);
console.log(priceUpdates.parsed[0].price);

// Use priceUpdates.binary.data to submit to on-chain contract
\`\`\`

## Key Price Feed IDs
- BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
- ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
- SOL/USD: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
- Full list: https://pyth.network/developers/price-feed-ids

## Price Structure
\`\`\`
Price {
  price: int64      // Price as integer (multiply by 10^expo for actual value)
  conf: uint64      // Confidence interval (same scale as price)
  expo: int32       // Exponent (typically -8, so divide by 10^8)
  publishTime: uint // Unix timestamp when price was published
}
\`\`\`

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

## Hermes API (Price Data)
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
  const pathPrefixes = ["/price-feeds/core", "/api-reference/pyth-core"];

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
