import {
  ArrowRight,
  CaretRight,
  ChartLine,
  Lightning,
  DiceSix,
  Clock,
  Globe,
  Shield,
  Code,
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
            Pyth Network is the leading oracle protocol that connects the owners of market data to applications on multiple blockchains. <Link href="https://insights.pyth.network/publishers" target="_blank" className={styles.link}>120+ first-party publishers</Link> are onboarded to the Pyth Network, including some of the biggest exchanges and market making firms in the world. <Link href="https://defillama.com/oracles/Pyth" target="_blank" className={styles.link}>Over 250 protocols</Link> trust Pyth to secure their applications.
          </p>

          {/* Our Products */}
          <section className={styles.productsSection}>
            <h2 className={styles.sectionHeading}>Our Products</h2>
            
            <div className={styles.productGrid}>
              <div className={styles.productCard}>
                <div className={styles.productHeader}>
                  <div className={[styles.productBadge, styles.coreBadge].join(" ")}>Core</div>
                  <ChartLine size={24} className={styles.productIcon} />
                </div>
                <h3 className={styles.productTitle}>Price Feeds</h3>
                <p className={styles.productDescription}>
                  Real-time, high-fidelity market data for smart contracts with sub-second latency.
                </p>
                <div className={styles.featureList}>
                  <div className={styles.feature}>
                    <Clock size={16} />
                    <span>Real-time price feeds</span>
                  </div>
                  <div className={styles.feature}>
                    <ChartLine size={16} />
                    <span>2000+ assets</span>
                  </div>
                  <div className={styles.feature}>
                    <Globe size={16} />
                    <span>100+ blockchains</span>
                  </div>
                </div>
                <Link href="/pyth-core" className={styles.productCta}>
                  Explore Price Feeds
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className={styles.productCard}>
                <div className={styles.productHeader}>
                  <div className={[styles.productBadge, styles.lazerBadge].join(" ")}>Lazer</div>
                  <Lightning size={24} className={styles.productIcon} />
                </div>
                <h3 className={styles.productTitle}>Lazer</h3>
                <p className={styles.productDescription}>
                  High-performance, low-latency price feeds for institutional applications.
                </p>
                <div className={styles.featureList}>
                  <div className={styles.feature}>
                    <Lightning size={16} />
                    <span>Ultra-low latency</span>
                  </div>
                  <div className={styles.feature}>
                    <Shield size={16} />
                    <span>Institutional grade</span>
                  </div>
                  <div className={styles.feature}>
                    <ChartLine size={16} />
                    <span>High-frequency data</span>
                  </div>
                </div>
                <Link href="/lazer" className={styles.productCta}>
                  Learn About Lazer
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className={styles.productCard}>
                <div className={styles.productHeader}>
                  <div className={[styles.productBadge, styles.mevBadge].join(" ")}>MEV Protection</div>
                  <Globe size={24} className={styles.productIcon} />
                </div>
                <h3 className={styles.productTitle}>Express Relay</h3>
                <p className={styles.productDescription}>
                  Eliminate MEV while gaining access to active searchers and liquidators.
                </p>
                <div className={styles.featureList}>
                  <div className={styles.feature}>
                    <Shield size={16} />
                    <span>MEV protection</span>
                  </div>
                  <div className={styles.feature}>
                    <Code size={16} />
                    <span>Active searchers</span>
                  </div>
                  <div className={styles.feature}>
                    <Globe size={16} />
                    <span>Multi-chain support</span>
                  </div>
                </div>
                <Link href="/express-relay" className={styles.productCta}>
                  Explore Express Relay
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className={styles.productCard}>
                <div className={styles.productHeader}>
                  <div className={[styles.productBadge, styles.randomnessBadge].join(" ")}>Randomness</div>
                  <DiceSix size={24} className={styles.productIcon} />
                </div>
                <h3 className={styles.productTitle}>Entropy</h3>
                <p className={styles.productDescription}>
                  Generate secure random numbers on the blockchain for your applications.
                </p>
                <div className={styles.featureList}>
                  <div className={styles.feature}>
                    <Shield size={16} />
                    <span>Cryptographically secure</span>
                  </div>
                  <div className={styles.feature}>
                    <Clock size={16} />
                    <span>Real-time generation</span>
                  </div>
                  <div className={styles.feature}>
                    <Globe size={16} />
                    <span>Multi-chain support</span>
                  </div>
                </div>
                <Link href="/entropy" className={styles.productCta}>
                  Learn About Entropy
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>

          {/* Quick Start */}
          <section className={styles.quickStartSection}>
            <h2 className={styles.sectionHeading}>Quick Start</h2>
            <p className={styles.sectionDescription}>
              Get started with Pyth Network by exploring our comprehensive documentation:
            </p>
            <ul className={styles.quickStartList}>
              <li>
                <strong><Link href="/pyth-core/getting-started" className={styles.link}>Price Feeds Getting Started</Link></strong> - Integrate real-time price data
              </li>
              <li>
                <strong><Link href="/lazer" className={styles.link}>Lazer Documentation</Link></strong> - High-performance price feeds
              </li>
              <li>
                <strong><Link href="/express-relay" className={styles.link}>Express Relay Integration</Link></strong> - Better orderflow mechanism to eliminate MEV
              </li>
              <li>
                <strong><Link href="/entropy" className={styles.link}>Entropy Implementation</Link></strong> - Secure randomness generation
              </li>
            </ul>
          </section>

          {/* Additional Resources */}
          <section className={styles.additionalResourcesSection}>
            <h2 className={styles.sectionHeading}>Additional Resources</h2>
            
            <div className={styles.resourceGrid}>
              <div className={styles.resourceCard}>
                <h3 className={styles.resourceTitle}>PYTH Token</h3>
                <p className={styles.resourceDescription}>
                  Learn about the Pyth governance token and its role in the network.
                </p>
                <Link href="/pyth-token" className={styles.resourceLink}>
                  Learn More →
                </Link>
              </div>

              <div className={styles.resourceCard}>
                <h3 className={styles.resourceTitle}>Oracle Integrity Staking</h3>
                <p className={styles.resourceDescription}>
                  Understand how staking ensures data quality and network security.
                </p>
                <Link href="/oracle-integrity-staking" className={styles.resourceLink}>
                  Learn More →
                </Link>
              </div>

              <div className={styles.resourceCard}>
                <h3 className={styles.resourceTitle}>Network Metrics</h3>
                <p className={styles.resourceDescription}>
                  Track the network&apos;s adoption, growth, and performance metrics.
                </p>
                <Link href="/metrics" className={styles.resourceLink}>
                  Learn More →
                </Link>
              </div>
            </div>
          </section>

          {/* Developer Resources */}
          <section className={styles.developerResourcesSection}>
            <h2 className={styles.sectionHeading}>Developer Resources</h2>
            <ul className={styles.developerList}>
              <li>
                <strong><Link href="/pyth-core/contract-addresses" className={styles.link}>Contract Addresses</Link></strong> - Find deployment addresses across all supported chains
              </li>
              <li>
                <strong><Link href="/whitepaper" className={styles.link}>Whitepaper</Link></strong> - Deep dive into Pyth Network&apos;s technical architecture
              </li>
              <li>
                <strong><Link href="/security" className={styles.link}>Security</Link></strong> - Learn about Pyth&apos;s security model and best practices
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};
