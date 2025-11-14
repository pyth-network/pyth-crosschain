import styles from "./index.module.scss";
import ResourcesForBuildersImage from "./resources-for-builders.svg";
import { Section } from "./section";
import { SectionCards, SectionCard } from "./section-card";
import SignalImage from "./signal.svg";
import { ProductCard } from "../../ProductCard";

export function DeveloperHubPreview() {
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
        <div className={styles.sectionProductsContent}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionHeaderTitle}>Products</p>
            <p className={styles.sectionHeaderSubtitle}>
              Integrate with the global price layer.
            </p>
          </header>
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
        </div>
      </section>

      <Section
        title="Resources for builders"
        subtitle="Get the most from Pyth Network"
        isHighlight
        image={<ResourcesForBuildersImage />}
      >
        <SectionCards>
          <SectionCard
            title="Grants"
            description="Handles most of the logic, including document search, content source adapters, and Markdown extensions."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Grants"
            description="Handles most of the logic, including document search, content source adapters, and Markdown extensions."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Grants"
            description="Handles most of the logic, including document search, content source adapters, and Markdown extensions."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
        </SectionCards>
      </Section>
      <Section
        title="Resources for builders"
        subtitle="Get the most from Pyth Network"
      >
        <SectionCards>
          <SectionCard
            title="Pyth Pro"
            description="Subscription-based price data for institutions and advanced use cases."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Pyth Pro"
            description="Subscription-based price data for institutions and advanced use cases."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Pyth Pro"
            description="Subscription-based price data for institutions and advanced use cases."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
          <SectionCard
            title="Pyth Pro"
            description="Subscription-based price data for institutions and advanced use cases."
            url="/price-feeds/pro"
            urlLabel="Link"
            image={<SignalImage />}
          />
        </SectionCards>
      </Section>

      <GradientDivider />

      <p>footer...</p>
    </div>
  );
}

function GradientDivider() {
  return <div className={styles.gradientDivider} role="presentation" />;
}

const products: ProductCardConfig[] = [
  {
    title: "Pyth Pro",
    description:
      "Subscription-based price data for institutions and advanced use cases.",
    href: "/price-feeds/pro",
    badgeLabel: "Price Feeds",
    badgeVariant: "Purple",
    features: [
      { label: "Ultra-low latency" },
      { label: "Crypto, Equities & Indexes" },
      { label: "Customizable channels and latency" },
      { label: "Dedicated support" },
    ],
    quickLinks: [
      {
        label: "Get Pyth Pro Access Token",
        href: "/price-feeds/pro/access-token",
      },
      { label: "Browse Supported Feeds", href: "/price-feeds/pro/price-feeds" },
      { label: "Error Codes", href: "/price-feeds/pro/error-codes" },
    ],
  },
  {
    title: "Pyth Core",
    description:
      "Subscription-based price data for institutions and advanced use cases.",
    href: "/price-feeds/core",
    badgeLabel: "Price Feeds",
    badgeVariant: "Purple",
    features: [
      { label: "400ms update frequency" },
      { label: "100+ blockchains" },
      { label: "Supports Pull and Push updates" },
      { label: "Decentralized Oracle" },
    ],
    quickLinks: [
      {
        label: "Get Pyth Pro Access Token",
        href: "/price-feeds/pro/access-token",
      },
      { label: "Browse Supported Feeds", href: "/price-feeds/pro/price-feeds" },
      { label: "Error Codes", href: "/price-feeds/pro/error-codes" },
    ],
  },
  {
    title: "Secure Randomness",
    description:
      "Subscription-based price data for institutions and advanced use cases.",
    href: "/entropy",
    badgeLabel: "Entropy",
    badgeVariant: "Orange",
    features: [
      { label: "400ms update frequency" },
      { label: "100+ blockchains" },
      { label: "Supports Pull and Push updates" },
      { label: "Decentralized Oracle" },
    ],
    quickLinks: [
      {
        label: "Get Pyth Pro Access Token",
        href: "/price-feeds/pro/access-token",
      },
      { label: "Browse Supported Feeds", href: "/price-feeds/pro/price-feeds" },
      { label: "Error Codes", href: "/price-feeds/pro/error-codes" },
    ],
  },
];

type ProductCardConfig = {
  title: string;
  description: string;
  href: string;
  badgeLabel: string;
  badgeVariant: "Purple" | "Orange";
  features: { label: string }[];
  quickLinks: { label: string; href: string }[];
};
