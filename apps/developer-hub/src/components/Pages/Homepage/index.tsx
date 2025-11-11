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
              href: "/price-feeds/core",
            },
            { label: "API Reference", href: "/price-feeds/core/api-reference" },
            {
              label: "Contract Addresses",
              href: "/price-feeds/core/contract-addresses",
            },
          ]}
          buttonLabel="Get started"
          buttonHref="/price-feeds/core"
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
              href: "/price-feeds/pro/access-token",
            },
            {
              label: "Browse Supported Feeds",
              href: "/price-feeds/pro/price-feeds",
            },
            { label: "Error Codes", href: "/price-feeds/pro/error-codes" },
          ]}
          buttonLabel="Get started"
          buttonHref="/price-feeds/pro"
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
