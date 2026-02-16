import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# Pyth Network Documentation

> First-party financial oracle delivering real-time market data to 100+ blockchains.

## AI Agent Playbook

For an opinionated integration guide with code snippets and step-by-step procedures:
> https://docs.pyth.network/SKILL.md

## Products

### Pyth Core — Decentralized Price Oracle
Pull-based oracle providing 500+ price feeds with 400ms updates across 100+ chains. Applications fetch signed prices from Hermes and verify on-chain in a single transaction.
Best for: DeFi protocols, lending, DEXs, derivatives.
Chains: EVM, Solana, Sui, Aptos, CosmWasm, NEAR, Starknet, and more.
> https://docs.pyth.network/llms-price-feeds-core.txt

### Pyth Pro — Low-Latency Price Streaming
Enterprise WebSocket streaming with configurable update channels (1ms–1s). Requires access token.
Best for: HFT, MEV strategies, market making, risk management.
SDK: \`@pythnetwork/pyth-lazer-sdk\` (TypeScript)
> https://docs.pyth.network/llms-price-feeds-pro.txt

### Entropy — On-Chain Randomness
Secure verifiable random number generation using commit-reveal. Callback-based API.
Best for: Gaming, NFT mints, lotteries, fair selection.
> https://docs.pyth.network/llms-entropy.txt

### Express Relay — MEV Protection
Auction-based MEV capture and order flow protection for DeFi protocols.
> https://docs.pyth.network/express-relay/index.mdx

## Unsure Which Price Feed Product?
Comparison of Core vs Pro with decision matrix:
> https://docs.pyth.network/llms-price-feeds.txt

## Individual Page Access
Fetch any documentation page as plain markdown by appending .mdx:
  https://docs.pyth.network/price-feeds/core/getting-started.mdx

## Machine-Readable Metadata
Programmatic discovery with token counts and content hashes:
> https://docs.pyth.network/llms-manifest.json

## Instructions for AI Agents
1. Read the product descriptions above to identify which product the user needs.
2. Fetch exactly ONE product file — each is self-contained with code examples, addresses, and patterns.
3. For deeper detail, fetch individual pages via .mdx URLs listed in each product file.
4. Do NOT fetch all files — only fetch the single best match for the user's question.
`;

export function GET() {
  return new NextResponse(CONTENT, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  });
}
