import { NextResponse } from "next/server";

export const revalidate = false;

export function GET() {
  const content = `
```

> First-party financial oracle delivering real-time market data to blockchain applications.

Pyth Network provides low-latency price feeds for 500+ assets across 50+ blockchains. Data is sourced directly from first-party publishers including major exchanges and market makers.

## Documentation

- Full documentation: https://docs.pyth.network/llms-full.txt
- Price Feeds: https://docs.pyth.network/price-feeds
- Entropy (Random Numbers): https://docs.pyth.network/entropy
- Express Relay (MEV Protection): https://docs.pyth.network/express-relay
- API Reference: https://docs.pyth.network/api-reference

## Products

### Price Feeds
Real-time, low-latency price data for cryptocurrencies, equities, FX, and commodities.
- Pull-based oracle: fetch prices on-demand to minimize gas costs
- Sub-second latency: prices update every 400ms
- Confidence intervals: statistical uncertainty bands around each price
- Docs: https://docs.pyth.network/price-feeds/core

### Pyth Pro
High-frequency price feeds for professional trading applications.
- Ultra-low latency: optimized for HFT and MEV strategies
- Direct WebSocket streaming
- Docs: https://docs.pyth.network/price-feeds/pro

### Entropy
Secure random number generation for blockchain applications.
- Provably fair: uses commit-reveal scheme
- Fast finality: random numbers in a single transaction
- Docs: https://docs.pyth.network/entropy

### Express Relay
MEV protection for DeFi protocols.
- Auction-based transaction ordering
- Protocol revenue sharing
- Docs: https://docs.pyth.network/express-relay

## Quick Start

### Solidity
```solidity
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MyContract {
    IPyth pyth;

    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function getPrice(bytes32 priceId) public view returns (int64) {
        PythStructs.Price memory price = pyth.getPrice(priceId);
        return price.price;
    }
}
```

### TypeScript
```typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network");
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const priceUpdates = await client.getLatestPriceUpdates([ETH_USD]);
console.log(priceUpdates.parsed[0].price);
```

## Key Concepts

### Price Feed ID
32-byte unique identifier for each price feed. Same ID works across all chains.
- BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
- ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
- SOL/USD: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
- Full list: https://pyth.network/developers/price-feed-ids

### Price Structure
```
Price {
  price: int64      // Price as integer (multiply by 10^expo for actual value)
  conf: uint64      // Confidence interval (same scale as price)
  expo: int32       // Exponent (typically -8, so divide by 10^8)
  publishTime: uint // Unix timestamp when price was published
}
```

### Update Flow (Pull Oracle)
1. Fetch price update from Hermes API: https://hermes.pyth.network
2. Submit update data to Pyth contract (pay small update fee)
3. Read price from Pyth contract in your code

## Contract Addresses

Pyth is deployed on 50+ chains. Key addresses:

### EVM Mainnet
- Ethereum: 0x4305FB66699C3B2702D4d05CF36551390A4c69C6
- Arbitrum: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Base: 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a
- Optimism: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- Polygon: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
- BNB Chain: 0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594
- Avalanche: 0x4305FB66699C3B2702D4d05CF36551390A4c69C6

### Solana
- Mainnet: FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH
- Devnet: gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s

Full list: https://docs.pyth.network/price-feeds/core/contract-addresses

## SDKs

- Solidity: @pythnetwork/pyth-sdk-solidity
- TypeScript/JavaScript: @pythnetwork/hermes-client, @pythnetwork/pyth-evm-js
- Python: pythclient
- Rust: pyth-sdk-rs, pyth-sdk-solana

## APIs

### Hermes API (Price Data)
Base URL: https://hermes.pyth.network
- GET /v2/updates/price/latest - Get latest prices
- GET /v2/updates/price/stream - SSE streaming prices
- OpenAPI spec: https://hermes.pyth.network/docs

### Fortuna API (Random Numbers)
Base URL: https://fortuna.pyth.network
- OpenAPI spec: https://fortuna.pyth.network/docs

## Common Patterns

### Update-Then-Read Pattern
Most integrations follow this pattern:
1. Fetch price update from Hermes API off-chain
2. Submit update to Pyth contract with fee
3. Read updated price in your contract logic

### Staleness Check
Always check price freshness in production:
```solidity
uint maxAge = 60; // 60 seconds
PythStructs.Price memory price = pyth.getPriceNoOlderThan(priceId, maxAge);
```

## Resources

- Website: https://pyth.network
- GitHub: https://github.com/pyth-network
- Discord: https://discord.gg/pythnetwork
- Twitter: https://twitter.com/PythNetwork

## Individual Page Access

Get any documentation page as markdown by appending .mdx:
- https://docs.pyth.network/price-feeds/core/getting-started.mdx
- https://docs.pyth.network/entropy/generate-random-numbers-evm.mdx
- https://docs.pyth.network/price-feeds/core/error-codes/index.mdx
- https://docs.pyth.network/price-feeds/core/error-codes/svm.mdx
```
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
