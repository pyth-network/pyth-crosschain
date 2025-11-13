import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";

import styles from "./index.module.scss";
import { ProductCard } from "../../ProductCard";

type DeveloperHubPreviewProps = {
  className?: string;
};

export function DeveloperHubPreview({ className }: DeveloperHubPreviewProps) {
  return (
    <div className={clsx(styles.preview, className)}>
      <section className={styles.sectionHero}>
        <div className={styles.sectionHeroContent}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>Pyth Developer Hub</p>
            <h1 className={styles.heroHeading}>
              Integrate with the global price layer.
            </h1>
            <Button
              size="md"
              variant="primary"
              className={styles.heroButton ?? ""}
            >
              Documentation
            </Button>
          </div>
          <div className={styles.heroGraphic}>
            <div className={clsx(styles.heroStripes, styles.heroStripesBack)} />
            <div
              className={clsx(styles.heroStripes, styles.heroStripesFront)}
            />
            {heroTokens.map((token) => (
              <HeroToken key={token.label} {...token} />
            ))}
            <div className={clsx(styles.heroRing, styles.heroRingPrimary)} />
            <div className={clsx(styles.heroRing, styles.heroRingSecondary)} />
            <div className={clsx(styles.heroRing, styles.heroRingTertiary)} />
          </div>
        </div>
      </section>

      <GradientDivider />

      <section className={styles.sectionProducts}>
        <div className={styles.sectionProductsContent}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionHeaderTitle}>Products</p>
            <p className={styles.sectionHeaderSubtitle}>
              Find the best something something
            </p>
          </header>
          <div className={styles.productsGrid}>
            {products.map((product) => (
              <div key={product.title} className={styles.productsCardWrapper}>
                <span
                  className={clsx(
                    styles.productBadge,
                    styles[`productBadge${product.badgeVariant}`],
                  )}
                >
                  {product.badgeLabel}
                </span>
                <span
                  className={clsx(
                    styles.productGlyph,
                    styles[`productGlyph${product.badgeVariant}`],
                  )}
                />
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

      <section
        className={clsx(
          styles.sectionResources,
          styles.sectionResourcesIllustrated,
        )}
      >
        <div className={styles.sectionResourcesContent}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionHeaderTitle}>Resources for Builders</p>
            <p className={styles.sectionHeaderSubtitle}>
              Get the most from Pyth Network
            </p>
          </header>
          <div className={styles.resourcesLayout}>
            <div className={styles.resourcesCards}>
              {builderResources.map((resource) => (
                <ResourceCard key={resource.title} {...resource} />
              ))}
            </div>
            <figure className={styles.resourcesIllustration}>
              <img
                src={RESOURCE_ILLUSTRATION}
                alt="Vault illustration"
                loading="lazy"
              />
            </figure>
          </div>
        </div>
      </section>

      <section
        className={clsx(styles.sectionResources, styles.sectionResourcesDense)}
      >
        <div className={styles.sectionResourcesContent}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionHeaderTitle}>Resources for Builders</p>
            <p className={styles.sectionHeaderSubtitle}>
              Get the most from Pyth Network
            </p>
          </header>
          <div className={styles.resourcesRow}>
            {builderResourcesGrid.map((resource) => (
              <ResourceCard key={resource.title} {...resource} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroToken({ label, symbol, variant, offset }: HeroTokenProps) {
  return (
    <div
      className={clsx(styles.heroToken, styles[`heroToken${variant}`])}
      style={{ inset: offset }}
    >
      <span className={styles.heroTokenSymbol}>{symbol}</span>
      <span className={styles.heroTokenLabel}>{label}</span>
    </div>
  );
}

function GradientDivider() {
  return <div className={styles.gradientDivider} role="presentation" />;
}

function ResourceCard({
  title,
  description,
  ctaLabel,
  href,
  icon,
  ctaExternal,
}: ResourceCardProps) {
  return (
    <article className={styles.resourceCard}>
      <header className={styles.resourceCardHeader}>
        <div className={styles.resourceIcon}>
          <img src={icon} alt={`${title} icon`} loading="lazy" />
        </div>
        <div>
          <h3 className={styles.resourceTitle}>{title}</h3>
          <p className={styles.resourceDescription}>{description}</p>
        </div>
      </header>
      <a
        className={styles.resourceLink}
        href={href}
        target={ctaExternal ? "_blank" : undefined}
        rel={ctaExternal ? "noopener noreferrer" : undefined}
      >
        {ctaLabel}
      </a>
    </article>
  );
}

const RESOURCE_ILLUSTRATION =
  "http://localhost:3845/assets/6414487afdcf3cfe6309ce58b0914bba9c937f25.svg";
const RESOURCE_ICON_SIGNAL =
  "http://localhost:3845/assets/2f0725c486767db8c5dbed2259c6f7ef7059f826.svg";
const RESOURCE_ICON_PARTNERSHIPS =
  "http://localhost:3845/assets/43c8d79892685d4bb0630582c9bfd51b823606fe.svg";
const RESOURCE_ICON_HACKATHONS =
  "http://localhost:3845/assets/a99f08afc48686db5b068e76ef29e0d176831d5a.svg";

const heroTokens: HeroTokenConfig[] = [
  {
    label: "PYTH / USD",
    symbol: "Pyth Network",
    variant: "Primary",
    offset: "20% 45% auto auto",
  },
  {
    label: "APPL / USD",
    symbol: "Apple",
    variant: "Secondary",
    offset: "40% auto auto 35%",
  },
  {
    label: "EUR / USD",
    symbol: "Euro",
    variant: "Tertiary",
    offset: "6% auto auto 65%",
  },
];

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

const builderResources: ResourceCardConfig[] = [
  {
    title: "Grants",
    description:
      "Handles most of the logic, including document search, content source adapters, and Markdown extensions.",
    ctaLabel: "Check out",
    href: "/grants",
    icon: RESOURCE_ICON_SIGNAL,
    ctaExternal: false,
  },
  {
    title: "Partnerships",
    description:
      "Handles most of the logic, including document search, content source adapters, and Markdown extensions.",
    ctaLabel: "Link",
    href: "/partnerships",
    icon: RESOURCE_ICON_PARTNERSHIPS,
    ctaExternal: false,
  },
  {
    title: "Hackathons",
    description:
      "Handles most of the logic, including document search, content source adapters, and Markdown extensions.",
    ctaLabel: "Link",
    href: "/hackathons",
    icon: RESOURCE_ICON_HACKATHONS,
    ctaExternal: false,
  },
];

const builderResourcesGrid: ResourceCardConfig[] = [
  ...builderResources,
  {
    title: "Partnerships",
    description:
      "Handles most of the logic, including document search, content source adapters, and Markdown extensions.",
    ctaLabel: "Link",
    href: "/partnerships",
    icon: RESOURCE_ICON_PARTNERSHIPS,
    ctaExternal: false,
  },
];

type HeroTokenConfig = {
  label: string;
  symbol: string;
  variant: "Primary" | "Secondary" | "Tertiary";
  offset: string;
};

type HeroTokenProps = HeroTokenConfig;

type ProductCardConfig = {
  title: string;
  description: string;
  href: string;
  badgeLabel: string;
  badgeVariant: "Purple" | "Orange";
  features: { label: string }[];
  quickLinks: { label: string; href: string }[];
};

type ResourceCardConfig = {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  icon: string;
  ctaExternal?: boolean;
};

type ResourceCardProps = ResourceCardConfig;
