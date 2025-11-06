import { Lightning } from "@phosphor-icons/react/dist/ssr";

import styles from "./index.module.scss";
import { ProductCard } from "../../ProductCard";

export const Homepage = () => {
  return (
    <div className={styles.landing}>
      <h2>Homepage Landing Page</h2>
      <div className={styles.cards}>
        <ProductCard
          title="Pyth Core"
          description="Stable, secure, and decentralized price data source for DeFi and TradFi applications."
          features={[
            { label: "400ms frequency", icon: <Lightning size={12.5} /> },
            {
              label: "100+ blockchains",
              icon: <Lightning size={12.5} />,
            },
            {
              label: "Confidence intervals",
              icon: <Lightning size={12.5} />,
            },
            { label: "2500+ price feeds", icon: <Lightning size={12.5} /> },
          ]}
          quickLinks={[
            {
              label: "Getting Started",
              href: "/price-feeds/v1/getting-started",
            },
            { label: "API Reference", href: "/openapi/hermes" },
            {
              label: "Contract Addresses",
              href: "/price-feeds/v1/contract-addresses",
            },
          ]}
          buttonLabel="Get started"
          buttonHref="/price-feeds/v1"
        />
        <ProductCard
          title="Pyth Pro"
          description="Subscription-based price data for institutions and advanced use cases."
          features={[
            { label: "Ultra-low latency", icon: <Lightning size={12.5} /> },
            {
              label: "Crypto, Equities & Indexes",
              icon: <Lightning size={12.5} />,
            },
            {
              label: "Customizable channels and latency",
              icon: <Lightning size={12.5} />,
            },
            { label: "Dedicated support", icon: <Lightning size={12.5} /> },
          ]}
          quickLinks={[
            {
              label: "Get Pyth Pro Access Token",
              href: "/price-feeds/v2/acquire-an-access-token",
            },
            { label: "Browse Supported Feeds", href: "/price-feeds" },
            { label: "Error Codes", href: "/price-feeds" },
          ]}
          buttonLabel="Get started"
          buttonHref="/price-feeds"
        />
        <ProductCard
          title="Entropy"
          description="Generate verifiable random numbers on-chain using Pyth's entropy service for your smart contracts."
          features={[
            { label: "On-chain randomness", icon: <Lightning size={12.5} /> },
            { label: "Verifiable results", icon: <Lightning size={12.5} /> },
            { label: "Multiple chains", icon: <Lightning size={12.5} /> },
          ]}
          quickLinks={[
            {
              label: "Getting Started",
              href: "/entropy/create-your-first-entropy-app",
            },
            { label: "Protocol Design", href: "/entropy/protocol-design" },
            { label: "Examples", href: "/entropy/examples" },
          ]}
          buttonLabel="Get started"
          buttonHref="/entropy"
        />
      </div>
    </div>
  );
};
