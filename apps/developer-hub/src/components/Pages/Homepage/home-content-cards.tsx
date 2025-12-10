import { Book, ChartScatter, CodeBlock, CurrencyDollarSimple, Key, ListChecks, Wrench } from "@phosphor-icons/react/dist/ssr";


export type ProductCardConfigType = {
  title: string;
  description: string;
  href: string;
  features: { label: string }[];
  quickLinks: { label: string; href: string }[];
};


export const products: ProductCardConfigType[] = [
  {
    title: "Pyth Pro",
    description:
      "Subscription-based price data for institutions and advanced use cases. Previously known as Lazer.",
    href: "/price-feeds/pro",
    features: [
      { label: "Ultra-low latency" },
      { label: "Crypto, Equities & Indexes" },
      { label: "Customizable channels and latency" },
      { label: "Dedicated support" },
    ],
    quickLinks: [
      {
        label: "Get Pyth Pro Access Token",
        href: "/price-feeds/pro/acquire-access-token",
      },
      {
        label: "Browse Supported Feeds",
        href: "/price-feeds/pro/price-feed-ids",
      },
      { label: "Pricing", href: "https://www.pyth.network/pricing" },
    ],
  },
  {
    title: "Pyth Core",
    description:
      "Decentralized price feeds for DeFi and TradFi builders with deterministic on-chain delivery.",
    href: "/price-feeds/core",
    features: [
      { label: "400ms update frequency" },
      { label: "100+ blockchains" },
      { label: "Supports Pull and Push updates" },
      { label: "Decentralized Oracle" },
    ],
    quickLinks: [
      {
        label: "Supported Blockchains",
        href: "/price-feeds/core/contract-addresses",
      },
      {
        label: "Browse Supported Feeds",
        href: "/price-feeds/core/price-feeds",
      },
      { label: "API Reference", href: "/price-feeds/core/api-reference" },
    ],
  },
  {
    title: "Entropy",
    description:
      "Secure, Verifiable Random Number Generator for EVM-based smart contracts.",
    href: "/entropy",
    features: [
      { label: "On-chain randomness" },
      { label: "Verifiable results" },
      { label: "Pay in native token" },
      { label: "Supports 20+ EVM chains" },
    ],
    quickLinks: [
      {
        label: "Chainlist",
        href: "/entropy/chainlist",
      },
      { label: "Protocol Design", href: "/entropy/protocol-design" },
      {
        label: "Entropy Explorer",
        href: "https://entropy-explorer.pyth.network/",
      },
    ],
  },
];



export const additionalResources = [
  {
    title: "Pyth Token",
    description: "The native token powering governance and staking across the Pyth Network.",
    href: "/pyth-token",
    icon: <CurrencyDollarSimple />,
  },
  {
    title: "Oracle Integrity Staking",
    description: "Stake PYTH to support data publishers and secure the integrity of Pyth price feeds.",
    href: "/oracle-integrity-staking",
    icon: <Wrench />,
  },
  {
    title: "Pyth Metrics",
    description: "Track network performance, feed activity, and ecosystem growth in real time.",
    href: "/metrics",
    icon: <ChartScatter />,
  },
];

export const developerResources = [
  {
    title: "Get Your Access Token",
    description: "Request access for the Pyth Ultra Low Latency price feeds.",
    href: "/access-token",
    icon: <Key />
  },
  {
    title: "Supported Feeds",
    description: "Explore the complete list of supported price feeds for Pyth Pro.",
    href: "/price-feeds/pro/price-feed-ids",
    icon: <ListChecks />
  },
  {
    title: "Pyth API Documentation",
    description: "Learn how to use the Pyth API to access real-time price data.",
    href: "/api-documentation",
    icon: <Book />
  },
  {
    title: "API Reference",
    description: "Explore the complete API reference for Pyth Pro.",
    href: "https://pyth-lazer.dourolabs.app/docs",
    icon: <CodeBlock />
  }
]