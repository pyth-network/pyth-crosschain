import {
  ChartLine as BarChartIcon,
  Clock as ClockIcon,
  Lightning as LightningIcon,
  Shuffle as MultiChainIcon,
  Shield as ShieldIcon,
  Code as CodeIcon,
  List as ListIcon,
  Key as KeyIcon,
  CurrencyDollar as MoneyWavyIcon,
} from "@phosphor-icons/react/dist/ssr";

import styles from "./index.module.scss";
import { ProductCard } from "../../ProductCard";

export function PriceFeedsLandingPage() {
  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h1 className={styles.title}>Price Feeds</h1>
        <p className={styles.lead}>
          Pyth Price Feeds deliver real-time financial market data sources from
          120+ first-party providers. These providers include leading exchanges,
          banks, trading firms, and market makers. Additionally, Pyth Price data
          can be verified on 100+ blockchains.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.h2}>Product Options</h2>
        <p className={styles.body}>
          Pyth offers two main versions of price feeds, each optimized for
          different use cases:
        </p>

        <div className={styles.gridTwo}>
          <ProductCard
            badge="Pro"
            badgeColor="bg-blue-600"
            icon={<LightningIcon size={24} />}
            title="Pyth Pro"
            description="Subscription-based price data for institutions and advanced use cases. Previously known as Lazer."
            features={[
              { icon: <LightningIcon size={16} />, text: "Ultra-low latency" },
              {
                icon: <BarChartIcon size={16} />,
                text: "Crypto, Equities & Indexes",
              },
              {
                icon: <MultiChainIcon size={16} />,
                text: "Customizable channels and latency",
              },
              { icon: <ShieldIcon size={16} />, text: "Dedicated support" },
            ]}
            quickActions={[
              {
                icon: <ListIcon size={16} />,
                title: "Available Price Feeds",
                href: "./price-feeds/pro/price-feed-ids",
              },
              {
                icon: <KeyIcon size={16} />,
                title: "Get an access token",
                href: "https://tally.so/r/nP2lG5",
              },
              {
                icon: <MoneyWavyIcon size={16} />,
                title: "Pricing",
                href: "https://www.pyth.network/pricing",
              },
            ]}
            ctaText="Explore Pro Documentation"
            href="./price-feeds/pro"
          />

          <ProductCard
            badge="Core"
            badgeColor="bg-green-600"
            icon={<BarChartIcon size={24} />}
            title="Pyth Core"
            description="The original Pyth oracle: decentralized price feeds for DeFi and TradFi builders."
            features={[
              { icon: <ClockIcon size={16} />, text: "400ms update frequency" },
              { icon: <MultiChainIcon size={16} />, text: "100+ blockchains" },
              {
                icon: <ShieldIcon size={16} />,
                text: "Supports Pull and Push updates",
              },
              { icon: <ShieldIcon size={16} />, text: "Decentralized Oracle" },
            ]}
            quickActions={[
              {
                icon: <ListIcon size={16} />,
                title: "Available Price Feeds",
                href: "./price-feeds/core/price-feeds",
              },
              {
                icon: <CodeIcon size={16} />,
                title: "Contract Addresses",
                href: "./price-feeds/core/contract-addresses",
              },
              {
                icon: <MoneyWavyIcon size={16} />,
                title: "Current Fees",
                href: "./price-feeds/core/current-fees",
              },
            ]}
            ctaText="Explore Core Documentation"
            href="./price-feeds/core"
          />
        </div>
      </div>

      <div className={styles.sectionTop}>
        <h2 className={styles.h2}>Additional Resources</h2>

        <div className={styles.gridThree}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Price Feed IDs</h3>
            <p className={styles.cardText}>
              Complete list of price feed IDs for both Pro and Core.
            </p>
            <a href="./price-feeds/core/price-feeds" className={styles.link}>
              Pyth Core IDs →
            </a>
            <span className={styles.divider}>|</span>
            <a href="./price-feeds/pro/price-feed-ids" className={styles.link}>
              Pyth Pro IDs →
            </a>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>API Reference</h3>
            <p className={styles.cardText}>
              Complete API documentation for both Pro and Core.
            </p>
            <a href="./price-feeds/core/api-reference" className={styles.link}>
              Core APIs →
            </a>
            <span className={styles.divider}>|</span>
            <a href="./price-feeds/pro/api-reference" className={styles.link}>
              Pro API →
            </a>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Examples</h3>
            <p className={styles.cardText}>
              Sample applications and integration examples.
            </p>
            <a
              href="https://github.com/pyth-network/pyth-examples"
              className={styles.link}
            >
              View Examples →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
