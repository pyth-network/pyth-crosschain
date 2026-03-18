import { ProductCard } from "../../ProductCard";
import styles from "./index.module.scss";
import ResourcesForBuildersImage from "./resources-for-builders.svg";
import { Section } from "./section";
import { SectionCard, SectionCards } from "./section-card";
import SignalImage from "./signal.svg";

export const Homepage = () => {
  return (
    <div className={styles.preview}>
      <section className={styles.sectionHero}>
        <div className={styles.sectionHeroContent}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>Developer Hub</h1>
            <p className={styles.heroSubtitle}>
              Integrate with the global price layer.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.sectionProducts}>
        <p className={styles.sectionHeaderTitle}>Products</p>
        <p className={styles.sectionHeaderSubtitle}>
          Connect to the global market data and randomness layer.
        </p>
        <div className={styles.productsGrid}>
          {products.map((product: ProductCardConfig) => (
            <div className={styles.productsCardWrapper} key={product.title}>
              <ProductCard
                buttonHref={product.href}
                buttonLabel="Get started"
                description={product.description}
                features={product.features}
                quickLinks={product.quickLinks}
                title={product.title}
              />
            </div>
          ))}
        </div>
      </section>

      <Section
        image={<ResourcesForBuildersImage />}
        isHighlight
        subtitle="Explore the Pyth Network"
        title="Additional Resources"
      >
        <SectionCards>
          <SectionCard
            description="The native token powering governance and staking across the Pyth Network."
            image={<SignalImage />}
            title="Pyth Token"
            url="/pyth-token"
            urlLabel="Read more"
          />
          <SectionCard
            description="Stake PYTH to support data publishers and secure the integrity of Pyth price feeds."
            image={<SignalImage />}
            title="Oracle Integrity Staking"
            url="/oracle-integrity-staking"
            urlLabel="Read more"
          />
          <SectionCard
            description="Track network performance, feed activity, and ecosystem growth in real time."
            image={<SignalImage />}
            title="Pyth Metrics"
            url="/metrics"
            urlLabel="Read more"
          />
        </SectionCards>
      </Section>
      <Section
        subtitle="Explore the Pyth Network for developers"
        title="Resources for Developers"
      >
        <SectionCards>
          <SectionCard
            description="Request access for the Pyth Ultra Low Latency price feeds."
            image={<SignalImage />}
            title="Get Your Access Token"
            url="/price-feeds/pro/acquire-access-token"
            urlLabel="Link"
          />
          <SectionCard
            description="Explore the complete list of supported price feeds for Pyth Pro."
            image={<SignalImage />}
            title="Supported Feeds -- Pyth Pro"
            url="/price-feeds/pro/price-feed-ids"
            urlLabel="Link"
          />
          <SectionCard
            description="Explore the complete list of supported chains for Pyth Core."
            image={<SignalImage />}
            title="Supported Blockchains -- Pyth Core"
            url="/price-feeds/core/contract-addresses"
            urlLabel="Link"
          />
          <SectionCard
            description="Explore the complete API reference for Pyth Pro."
            image={<SignalImage />}
            target="_blank"
            title="API Reference -- Pyth Pro"
            url="https://pyth-lazer.dourolabs.app/docs"
            urlLabel="Link"
          />
        </SectionCards>
      </Section>

      <GradientDivider />
    </div>
  );
};

function GradientDivider() {
  return <div className={styles.gradientDivider} role="presentation" />;
}

const products: ProductCardConfig[] = [
  {
    description:
      "Subscription-based price data for institutions and advanced use cases. Previously known as Lazer.",
    features: [
      { label: "Ultra-low latency" },
      { label: "Crypto, Equities & Indexes" },
      { label: "Customizable channels and latency" },
      { label: "Dedicated support" },
    ],
    href: "/price-feeds/pro",
    quickLinks: [
      {
        href: "/price-feeds/pro/acquire-access-token",
        label: "Get Pyth Pro Access Token",
      },
      {
        href: "/price-feeds/pro/price-feed-ids",
        label: "Browse Supported Feeds",
      },
      { href: "https://www.pyth.network/pricing", label: "Pricing" },
    ],
    title: "Pyth Pro",
  },
  {
    description:
      "Decentralized price feeds for DeFi and TradFi builders with deterministic on-chain delivery.",
    features: [
      { label: "400ms update frequency" },
      { label: "100+ blockchains" },
      { label: "Supports Pull and Push updates" },
      { label: "Decentralized Oracle" },
    ],
    href: "/price-feeds/core",
    quickLinks: [
      {
        href: "/price-feeds/core/contract-addresses",
        label: "Supported Blockchains",
      },
      {
        href: "/price-feeds/core/price-feeds",
        label: "Browse Supported Feeds",
      },
      { href: "/price-feeds/core/api-reference", label: "API Reference" },
    ],
    title: "Pyth Core",
  },
  {
    description:
      "Secure, Verifiable Random Number Generator for EVM-based smart contracts.",
    features: [
      { label: "On-chain randomness" },
      { label: "Verifiable results" },
      { label: "Pay in native token" },
      { label: "Supports 20+ EVM chains" },
    ],
    href: "/entropy",
    quickLinks: [
      {
        href: "/entropy/chainlist",
        label: "Chainlist",
      },
      { href: "/entropy/protocol-design", label: "Protocol Design" },
      {
        href: "https://entropy-explorer.pyth.network/",
        label: "Entropy Explorer",
      },
    ],
    title: "Entropy",
  },
];

type ProductCardConfig = {
  title: string;
  description: string;
  href: string;
  features: { label: string }[];
  quickLinks: { label: string; href: string }[];
};
