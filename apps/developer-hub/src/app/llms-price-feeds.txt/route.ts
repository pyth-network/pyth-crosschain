import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# Pyth Price Feeds — Overview

> This file covers both Pyth Core and Pyth Pro. For detailed quick-starts, fetch the specific product file below.

## Pyth Core — Decentralized Price Oracle

Pull-based oracle providing 500+ price feeds with 400ms updates across 100+ chains. Applications fetch signed price data from the off-chain Hermes service and submit it on-chain for verification — all in a single transaction.

- **No API key required** — fully permissionless
- **Chains**: EVM, Solana, Sui, Aptos, CosmWasm, NEAR, Starknet, Fuel, IOTA, TON, Stacks
- **SDKs**: Solidity (\`@pythnetwork/pyth-sdk-solidity\`), TypeScript (\`@pythnetwork/hermes-client\`), Python, Rust
- **Data**: 500+ feeds (crypto, equities, FX, commodities) with confidence intervals

Full quick-start with code examples and contract addresses:
> https://docs.pyth.network/llms-price-feeds-core.txt

## Pyth Pro — Low-Latency Price Streaming

Enterprise WebSocket streaming for institutional and latency-sensitive applications. Real-time price delivery with configurable update channels (1ms to 1s intervals).

- **Access token required** — contact Pyth team at https://pyth.network/pro
- **Channels**: \`real_time\`, \`fixed_rate@200ms\`, \`fixed_rate@50ms\`, \`fixed_rate@1ms\`
- **SDK**: TypeScript (\`@pythnetwork/pyth-lazer-sdk\` / \`PythLazerClient\`)
- **On-chain verification**: EVM (ECDSA) and Solana (Ed25519) signed payloads
- **APIs**: WebSocket streaming, REST, History (OHLC), Proxy

Full quick-start with code examples and endpoints:
> https://docs.pyth.network/llms-price-feeds-pro.txt

## Which Should I Use?

| Criteria | Pyth Core | Pyth Pro |
|----------|-----------|----------|
| Use case | DeFi protocols, lending, DEXs | HFT, MEV, market making |
| Latency | ~400ms updates | 1–50ms updates |
| Access | Permissionless | Subscription required |
| Delivery | Pull (fetch on-demand) | Push (WebSocket stream) |
| Chain support | 100+ chains | EVM, Solana, Fogo |
| Best for | On-chain DeFi integration | Off-chain trading systems |

**Choose Core** if you're building a DeFi protocol that needs on-chain price verification.
**Choose Pro** if you need the fastest possible price delivery for trading infrastructure.

## Quick Start (TypeScript — Pyth Core)

\`\`\`typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network");
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const priceUpdates = await client.getLatestPriceUpdates([ETH_USD]);
console.log(priceUpdates.parsed[0].price);
// Use priceUpdates.binary.data to submit on-chain
\`\`\`

## AI Agent Playbook

For an opinionated, step-by-step integration guide:
> https://docs.pyth.network/SKILL.md
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
