import { Button } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";

import styles from "./index.module.scss";

export const HeroContent = () => {
  return (
    <div className={styles.heroContent}>
      <h1 className={styles.title}>
        Real-time price data for your applications
      </h1>
      <p className={styles.subtitle}>
        Access accurate, decentralized price feeds for DeFi, trading, and more
      </p>
      <div className={styles.ctaGroup}>
        <Button variant="primary" size="lg" href="/pyth-core/getting-started">
          Get started with Price Feeds
        </Button>
        <Link href="#product-grid" className={styles.secondaryLink ?? ""}>
          Explore all products
        </Link>
      </div>
    </div>
  );
};
