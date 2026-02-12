import { NextResponse } from "next/server";

import tokenData from "../../data/llm-token-counts.json";

export const revalidate = false;

const FILE_METADATA: Record<
  string,
  {
    cache_max_age: number;
    description: string;
    tier: number;
    title: string;
    topics: string[];
  }
> = {
  "/llms-entropy.txt": {
    cache_max_age: 3600,
    description:
      "Verifiable random number generation for gaming and fair selection.",
    tier: 2,
    title: "Entropy — On-Chain Randomness",
    topics: ["randomness", "vrf", "gaming", "nft"],
  },
  "/llms-price-feeds-core.txt": {
    cache_max_age: 3600,
    description:
      "Decentralized pull-based oracle for DeFi. Covers EVM, Solana, Sui, Aptos.",
    tier: 2,
    title: "Pyth Core — Price Oracle",
    topics: ["oracle", "price-feed", "defi", "evm", "solana", "sui", "aptos"],
  },
  "/llms-price-feeds-pro.txt": {
    cache_max_age: 3600,
    description:
      "Enterprise WebSocket price streaming for HFT and institutional use.",
    tier: 2,
    title: "Pyth Pro — Low-Latency Streaming",
    topics: ["streaming", "websocket", "hft", "mev", "low-latency"],
  },
  "/llms-price-feeds.txt": {
    cache_max_age: 3600,
    description:
      "Comparison and routing between Core and Pro price feed products.",
    tier: 1,
    title: "Price Feeds — Core vs Pro Overview",
    topics: ["overview", "comparison", "routing"],
  },
  "/llms.txt": {
    cache_max_age: 86_400,
    description: "Product overview and routing to detailed documentation",
    tier: 1,
    title: "Routing Index",
    topics: ["overview", "routing"],
  },
  "/SKILL.md": {
    cache_max_age: 86_400,
    description:
      "Opinionated integration guide with step-by-step procedures and code snippets.",
    tier: 1,
    title: "Pyth Developer Playbook",
    topics: ["integration", "tutorial", "playbook"],
  },
};

const tokenFiles = tokenData.files as Record<
  string,
  { bytes: number; hash: string; tokens: number }
>;

export function GET() {
  const files = Object.entries(FILE_METADATA).map(([path, metadata]) => {
    const data = tokenFiles[path];
    return {
      cache_max_age: metadata.cache_max_age,
      content_hash: data?.hash ?? "",
      description: metadata.description,
      path,
      tier: metadata.tier,
      title: metadata.title,
      token_count: data?.tokens ?? 0,
      topics: metadata.topics,
    };
  });

  const manifest = {
    base_url: "https://docs.pyth.network",
    description:
      "Decentralized oracle network for price feeds, randomness, and MEV protection",
    files,
    generated_at: tokenData.generated_at,
    name: "Pyth Network",
    page_access: {
      description:
        "Append .mdx to any documentation URL for plain markdown content",
      example: "https://docs.pyth.network/price-feeds/core/getting-started.mdx",
      pattern: "https://docs.pyth.network/{path}.mdx",
    },
    tokenizer: tokenData.tokenizer,
    tokenizer_note: tokenData.tokenizer_note,
    version: "1.0",
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "application/json; charset=utf-8",
    },
    status: 200,
  });
}
