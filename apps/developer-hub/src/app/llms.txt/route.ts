import { NextResponse } from "next/server";

export const revalidate = false;

const CONTENT = `# Pyth Network Documentation

> First-party financial oracle delivering real-time market data to 100+ blockchains.

This is the routing index for Pyth Network's documentation. AI agents should
identify the product the user needs from the descriptions below, then fetch
exactly one product file — each is self-contained with code examples,
addresses, and patterns. Do not fetch every link.

## AI Agent Playbook

- [Pyth Developer Playbook](https://docs.pyth.network/SKILL.md): Opinionated integration guide with step-by-step procedures and code snippets.

## Products

- [Pyth Core — Decentralized Price Oracle](https://docs.pyth.network/llms-price-feeds-core.txt): Pull-based oracle with 500+ price feeds, 400ms updates, 100+ chains (EVM, Solana, Sui, Aptos, CosmWasm, NEAR, Starknet, and more). Best for DeFi protocols, lending, DEXs, and derivatives.
- [Pyth Pro — Low-Latency Price Streaming](https://docs.pyth.network/llms-price-feeds-pro.txt): Enterprise WebSocket streaming with configurable update channels (1ms–1s). Requires an API key. Best for HFT, MEV strategies, market making, and risk management.
- [Entropy — On-Chain Randomness](https://docs.pyth.network/llms-entropy.txt): Secure verifiable random number generation using commit-reveal with a callback-based API. Best for gaming, NFT mints, lotteries, and fair selection.
- [Express Relay — MEV Protection](https://docs.pyth.network/express-relay/index.mdx): Auction-based MEV capture and order flow protection for DeFi protocols.

## Choosing Between Core and Pro

- [Price Feeds — Core vs Pro Overview](https://docs.pyth.network/llms-price-feeds.txt): Side-by-side comparison and decision matrix for picking between Pyth Core and Pyth Pro.

## Pyth Pro Tooling

- [Pyth Pro MCP Server](https://docs.pyth.network/price-feeds/pro/mcp.mdx): Setup, tools, and troubleshooting for the MCP server that exposes Pyth Pro to AI assistants.
- [Pyth Pro MCP Skills](https://docs.pyth.network/price-feeds/pro/mcp-skills.mdx): Pre-built skills for price alerts, portfolio tracking, FX conversion, volatility analysis, and more.

## Individual Page Access

- [Markdown page access](https://docs.pyth.network/price-feeds/core/getting-started.mdx): Any documentation page is available as plain markdown by appending \`.mdx\` to its URL.

## Machine-Readable Metadata

- [llms-manifest.json](https://docs.pyth.network/llms-manifest.json): Programmatic discovery of all routing files with token counts and content hashes.
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
