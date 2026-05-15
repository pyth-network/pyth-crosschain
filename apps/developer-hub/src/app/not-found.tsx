import { ChartLine, DiceSix, Key, List } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@pythnetwork/component-library/Card";
import Link from "next/link";

import styles from "./not-found.module.scss";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <Card className={styles.card} nonInteractive variant="secondary">
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.heading}>You Found a Dead Route.</h1>
            <p className={styles.description}>
              We reorganized everything and added redirects across the site, but
              this link is one of the few that slipped through. Use the links
              below to get back to the docs.
            </p>
          </div>

          <div className={styles.navigationGrid}>
            <Link className={styles.navCard} href="/price-feeds">
              <div className={styles.navIcon}>
                <ChartLine size={24} weight="regular" />
              </div>
              <div className={styles.navContent}>
                <h3 className={styles.navTitle}>Price Feeds</h3>
                <p className={styles.navDescription}>
                  Explore Pyth Core and Pyth Pro price feeds
                </p>
              </div>
            </Link>

            <Link className={styles.navCard} href="/entropy">
              <div className={styles.navIcon}>
                <DiceSix size={24} weight="regular" />
              </div>
              <div className={styles.navContent}>
                <h3 className={styles.navTitle}>Entropy</h3>
                <p className={styles.navDescription}>
                  Secure, verifiable random number generation
                </p>
              </div>
            </Link>

            <Link
              className={styles.navCard}
              href="/price-feeds/pro/acquire-api-key"
            >
              <div className={styles.navIcon}>
                <Key size={24} weight="regular" />
              </div>
              <div className={styles.navContent}>
                <h3 className={styles.navTitle}>
                  Subscribe to Pyth Pro Prices
                </h3>
                <p className={styles.navDescription}>
                  Get your API key and start subscribing
                </p>
              </div>
            </Link>

            <Link
              className={styles.navCard}
              href="/price-feeds/pro/price-feed-ids"
            >
              <div className={styles.navIcon}>
                <List size={24} weight="regular" />
              </div>
              <div className={styles.navContent}>
                <h3 className={styles.navTitle}>Pyth Pro Price Feed IDs</h3>
                <p className={styles.navDescription}>
                  Browse available Pyth Pro price feeds
                </p>
              </div>
            </Link>
          </div>

          <p className={styles.footerText}>
            Missing something? If your old link used to work,{" "}
            <a
              className={styles.footerLink}
              href="https://dev-forum.pyth.network/"
              rel="noopener noreferrer"
              target="_blank"
            >
              open a thread in the Developer Forum
            </a>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
