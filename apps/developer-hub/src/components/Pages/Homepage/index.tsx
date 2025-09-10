import {
  ArrowRight,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "./index.module.scss";

export const Homepage = () => {
  return (
    <div className={styles.pageContainer}>
      {/* Left Sidebar Navigation */}
      <nav className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          {/* Introduction Section */}
          <div className={styles.navSection}>
            <div className={styles.introTitle}>Introduction</div>
          </div>

          {/* Product Documentation Section */}
          <div className={styles.navSection}>
            <h3 className={styles.sectionTitle}>Product Documentation</h3>
            <ul className={styles.navList}>
              <li>
                <Link href="/pyth-core" className={styles.navItem}>
                  <span>Price Feeds</span>
                  <ArrowRight size={14} className={styles.navIcon} />
                </Link>
              </li>
              <li>
                <Link href="/lazer" className={styles.navItem}>
                  <span>Lazer</span>
                  <ArrowRight size={14} className={styles.navIcon} />
                </Link>
              </li>
              <li>
                <Link href="/express-relay" className={styles.navItem}>
                  <span>Express Relay</span>
                  <ArrowRight size={14} className={styles.navIcon} />
                </Link>
              </li>
              <li>
                <Link href="/entropy" className={styles.navItem}>
                  <span>Entropy</span>
                  <ArrowRight size={14} className={styles.navIcon} />
                </Link>
              </li>
            </ul>
          </div>

          {/* Additional Information Section */}
          <div className={styles.navSection}>
            <h3 className={styles.sectionTitle}>Additional Information</h3>
            <ul className={styles.navList}>
              <li>
                <Link href="/pyth-token" className={styles.navItem}>
                  <span>PYTH Token</span>
                  <CaretRight size={14} className={styles.navIcon} />
                </Link>
              </li>
              <li>
                <Link href="/oracle-integrity-staking" className={styles.navItem}>
                  <span>Oracle Integrity Staking (OIS)</span>
                  <CaretRight size={14} className={styles.navIcon} />
                </Link>
              </li>
              <li>
                <Link href="/metrics" className={styles.navItem}>
                  <span>Pyth Metrics</span>
                  <CaretRight size={14} className={styles.navIcon} />
                </Link>
              </li>
              <li>
                <Link href="/whitepaper" className={styles.navItem}>
                  <span>Whitepaper</span>
                </Link>
              </li>
              <li>
                <Link href="/security" className={styles.navItem}>
                  <span>Security</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.title}>Welcome to Pyth Network</h1>
          <p className={styles.description}>
            Pyth Network is the leading oracle protocol that connects the owners of market data to applications on multiple blockchains. 
            120+ first-party publishers are onboarded to the Pyth Network, including some of the biggest exchanges and market making firms in the world. 
            Over 250 protocols trust Pyth to secure their applications.
          </p>
          
          <section className={styles.quickStart}>
            <h2>Quick Start</h2>
            <p>Get started with Pyth Network by exploring our comprehensive documentation:</p>
            <ul className={styles.quickStartList}>
              <li><strong>Price Feeds Getting Started</strong> - Integrate real-time price data</li>
              <li><strong>Lazer Documentation</strong> - High-performance price feeds</li>
              <li><strong>Express Relay Integration</strong> - Better orderflow mechanism to eliminate MEV</li>
              <li><strong>Entropy Implementation</strong> - Secure randomness generation</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};
