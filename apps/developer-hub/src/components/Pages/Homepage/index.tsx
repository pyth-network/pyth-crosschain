import styles from "./index.module.scss";
import ResourcesForBuildersImage from "./resources-for-builders.svg";
import { Section } from "./section";
import { SectionCards, SectionCard } from "./section-card";
import SignalImage from "./signal.svg";
import { ProductCard } from "../../ProductCard";

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
            <div key={product.title} className={styles.productsCardWrapper}>
              <ProductCard
                title={product.title}
                description={product.description}
                features={product.features}
                quickLinks={product.quickLinks}
                buttonLabel="Get started"
                buttonHref={product.href}
              />
            </div>
          ))}
        </div>
      </section>

      <Section
        title="Additional Resources"
        subtitle="Explore the Pyth Network"
        isHighlight
        image={<ResourcesForBuildersImage />}
      >
        <SectionCards>
          <SectionCard
            title="Pyth Token"
            description="The native token powering governance and staking across the Pyth Network."
            url="/pyth-token"
            urlLabel="Read more"
            image={<SignalImage />}
          />
          <SectionCard
            title="Oracle Integrity Staking"
            description="Stake PYTH to support data publishers and secure the integrity of Pyth price feeds."
            url="/oracle-integrity-staking"
            urlLabel="Read more"
            image={<SignalImage />}
          />
          <SectionCard
            title="Pyth Metrics"
            description="Track network performance, feed activity, and ecosystem growth in real time."
            url="/metrics"
            urlLabel="Read more"
            image={<SignalImage />}
          />
        </SectionCards>
      </Section>
      <Section
        title="Resources for Developers"
        subtitle="Explore the Pyth Network for developers"
      >
        <SectionCards>
          <SectionCard
            title="Get Your Access Token"
            description="Request access for the Pyth Ultra Low Latency price feeds."
            url="/price-feeds/pro/acquire-access-token"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Supported Feeds -- Pyth Pro"
            description="Explore the complete list of supported price feeds for Pyth Pro."
            url="/price-feeds/pro/price-feed-ids"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Supported Blockchains -- Pyth Core"
            description="Explore the complete list of supported chains for Pyth Core."
            url="/price-feeds/core/contract-addresses"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="API Reference -- Pyth Pro"
            description="Explore the complete API reference for Pyth Pro."
            url="https://pyth-lazer.dourolabs.app/docs"
            urlLabel="Link"
            image={<SignalImage />}
            target="_blank"
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

type ProductCardConfig = {
  title: string;
  description: string;
  href: string;
  features: { label: string }[];
  quickLinks: { label: string; href: string }[];
};
