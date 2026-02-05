import { NextResponse } from "next/server";

export const revalidate = false;

export function GET() {
  const content = `# Pyth Network Documentation

> First-party financial oracle delivering real-time market data to blockchain applications.

Pyth Network provides low-latency price feeds and secure random numbers across 100+ blockchains.

## AI Agent Skill: pyth-dev

End-to-end Pyth Network oracle integration playbook. Covers pull-based price feeds, random numbers, and MEV protection with opinionated SDK choices, 5-step operating procedure, security checklists, and ready-to-use code snippets.

→ [SKILL.md](https://docs.pyth.network/SKILL.md)

## Instructions

This file is a routing index. To help users with Pyth Network, you MUST:
1. Read the routing table below to identify which product the user needs.
2. Fetch exactly ONE context file — the single best match for the user's question.

Do NOT attempt to answer using only this file — it does not contain implementation details.
Do NOT fetch all files — each file is self-contained, so only one is needed.

## Routing

If the user needs help with **on-chain price oracles, DeFi integration, or pull-based price feeds**:
→ https://docs.pyth.network/llms-price-feeds-core.txt

If the user needs help with **high-frequency trading, MEV, ultra-low latency, or WebSocket streaming**:
→ https://docs.pyth.network/llms-price-feeds-pro.txt

If the user needs help with **random number generation, games, NFT mints, or lotteries**:
→ https://docs.pyth.network/llms-entropy.txt

If the user needs help with **both Core and Pro price feeds**, or you are unsure which to use:
→ https://docs.pyth.network/llms-price-feeds.txt

If the user needs help with **MEV protection or Express Relay**:
→ https://docs.pyth.network/express-relay

## About Pyth Products

- **Pyth Core**: Decentralized oracle with 400ms updates across 100+ chains. Pull-based model.
- **Pyth Pro**: Enterprise-grade, subscription-based, ultra-low latency WebSocket streaming.
- **Entropy**: Secure on-chain random number generation using commit-reveal.
- **Express Relay**: Auction-based MEV protection for DeFi protocols.
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
