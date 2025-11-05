import { Lightning } from "@phosphor-icons/react/dist/ssr";

import styles from "./index.module.scss";
import { ProductCard } from "../../ProductCard";

export const Homepage = () => {
  return (
    <div className={styles.landing}>
      <h2>Homepage Landing Page</h2>
      <div className={styles.cards}>
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
              href: "/docs/price-feeds/v2/acquire-an-access-token",
            },
            { label: "Browse Supported Feeds", href: "/docs/price-feeds" },
            { label: "Error Codes", href: "/docs/price-feeds" },
          ]}
          buttonLabel="Get started"
          buttonHref="/docs/price-feeds"
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
              href: "/docs/entropy/create-your-first-entropy-app",
            },
            { label: "Protocol Design", href: "/docs/entropy/protocol-design" },
            { label: "Examples", href: "/docs/entropy/examples" },
          ]}
          buttonLabel="Get started"
          buttonHref="/docs/entropy"
        />
      </div>
    </div>
  );
};
