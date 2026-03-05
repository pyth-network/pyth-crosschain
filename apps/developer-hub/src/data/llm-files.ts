export type LLMFileConfig = {
  cacheMaxAge: number;
  changeFrequency: "monthly" | "weekly";
  description: string;
  deprecated?: boolean;
  path: string;
  routeFile: string;
  tier: number;
  title: string;
  topics: string[];
};

export const LLM_FILES: LLMFileConfig[] = [
  {
    cacheMaxAge: 86_400,
    changeFrequency: "monthly",
    description: "Product overview and routing to detailed documentation",
    path: "/llms.txt",
    routeFile: "src/app/llms.txt/route.ts",
    tier: 1,
    title: "Routing Index",
    topics: ["overview", "routing"],
  },
  {
    cacheMaxAge: 3600,
    changeFrequency: "weekly",
    description:
      "Decentralized pull-based oracle for DeFi. Covers EVM, Solana, Sui, Aptos.",
    path: "/llms-price-feeds-core.txt",
    routeFile: "src/app/llms-price-feeds-core.txt/route.ts",
    tier: 2,
    title: "Pyth Core — Price Oracle",
    topics: ["oracle", "price-feed", "defi", "evm", "solana", "sui", "aptos"],
  },
  {
    cacheMaxAge: 3600,
    changeFrequency: "weekly",
    description:
      "Enterprise WebSocket price streaming for HFT and institutional use.",
    path: "/llms-price-feeds-pro.txt",
    routeFile: "src/app/llms-price-feeds-pro.txt/route.ts",
    tier: 2,
    title: "Pyth Pro — Low-Latency Streaming",
    topics: ["streaming", "websocket", "hft", "mev", "low-latency"],
  },
  {
    cacheMaxAge: 3600,
    changeFrequency: "monthly",
    description:
      "Comparison and routing between Core and Pro price feed products.",
    path: "/llms-price-feeds.txt",
    routeFile: "src/app/llms-price-feeds.txt/route.ts",
    tier: 1,
    title: "Price Feeds — Core vs Pro Overview",
    topics: ["overview", "comparison", "routing"],
  },
  {
    cacheMaxAge: 3600,
    changeFrequency: "weekly",
    description:
      "Verifiable random number generation for gaming and fair selection.",
    path: "/llms-entropy.txt",
    routeFile: "src/app/llms-entropy.txt/route.ts",
    tier: 2,
    title: "Entropy — On-Chain Randomness",
    topics: ["randomness", "vrf", "gaming", "nft"],
  },
  {
    cacheMaxAge: 86_400,
    changeFrequency: "monthly",
    deprecated: true,
    description: "Deprecated monolithic documentation file.",
    path: "/llms-full.txt",
    routeFile: "src/app/llms-full.txt/route.ts",
    tier: 0,
    title: "Full Documentation (Deprecated)",
    topics: [],
  },
  {
    cacheMaxAge: 86_400,
    changeFrequency: "monthly",
    description:
      "Opinionated integration guide with step-by-step procedures and code snippets.",
    path: "/SKILL.md",
    routeFile: "src/app/SKILL.md/route.ts",
    tier: 1,
    title: "Pyth Developer Playbook",
    topics: ["integration", "tutorial", "playbook"],
  },
];
