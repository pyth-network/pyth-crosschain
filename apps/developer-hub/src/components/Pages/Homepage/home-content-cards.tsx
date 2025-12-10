import { ArrowsDownUp, Book, ChartScatter, CheckCircle, CodeBlock, Coin, CurrencyBtc, CurrencyDollarSimple, DiceFive, GlobeSimple, Key, Lightning, ListChecks, Network, SlidersHorizontal, Wrench } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";





type Feature = {
  label: string;
  icon?: ReactNode | undefined;
};

type QuickLink = {
  label: string;
  href: string;
};

export type ProductCardConfigType = {
  title: string;
  badge?: string | undefined;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  features?: Feature[] | undefined;
  quickLinks?: QuickLink[] | undefined;
  buttonLabel?: string | undefined;
  href?: string | undefined;
  external?: boolean | undefined;
  className?: string | undefined;
};

export const products: ProductCardConfigType[] = [
  {
    title: "Pyth",
    badge: "PRO",
    description:
      "Subscription-based price data for institutions and advanced use cases. Previously known as Lazer.",
    href: "/price-feeds/pro",
    features: [
      { label: "Ultra-low latency", icon: <Lightning /> },
      { label: "Crypto, Equities & Indexes", icon: <CurrencyBtc /> },
      { label: "Customizable channels and latency", icon: <SlidersHorizontal /> },
      { label: "Dedicated support", icon: <Wrench /> },
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
    title: "Pyth",
    badge: "CORE",
    description:
      "Decentralized price feeds for DeFi and TradFi builders with deterministic on-chain delivery.",
    href: "/price-feeds/core",
    features: [
      { label: "400ms update frequency", icon: <Lightning /> },
      { label: "100+ blockchains", icon: <Network /> },
      { label: "Supports Pull and Push updates", icon: <ArrowsDownUp /> },
      { label: "Decentralized Oracle", icon: <GlobeSimple /> },
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
      { label: "On-chain randomness", icon: <DiceFive /> },
      { label: "Verifiable results", icon: <CheckCircle /> },
      { label: "Pay in native token", icon: <Coin /> },
      { label: "Supports 20+ EVM chains", icon: <Network /> },
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