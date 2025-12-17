import { ChartLine, DiceSix, Key, List } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@pythnetwork/component-library/Card";
import Link from "next/link";

import styles from "./not-found.module.scss";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <Card variant="secondary" className={styles.card} nonInteractive>
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
            <Link href="/price-feeds" className={styles.navCard}>
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

            <Link href="/entropy" className={styles.navCard}>
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
              href="/price-feeds/pro/acquire-access-token"
              className={styles.navCard}
            >
              <div className={styles.navIcon}>
                <Key size={24} weight="regular" />
              </div>
              <div className={styles.navContent}>
                <h3 className={styles.navTitle}>
                  Subscribe to Pyth Pro Prices
                </h3>
                <p className={styles.navDescription}>
                  Get your access token and start subscribing
                </p>
              </div>
            </Link>

            <Link
              href="/price-feeds/pro/price-feed-ids"
              className={styles.navCard}
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
              href="https://dev-forum.pyth.network/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
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
