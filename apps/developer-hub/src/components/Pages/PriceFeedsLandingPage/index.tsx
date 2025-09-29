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

import { ProductCard } from "../../ProductCard";

export function PriceFeedsLandingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          Price Feeds
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed max-w-4xl">
          Pyth Price Feeds deliver real-time financial market data sources from
          120+ first-party providers. These providers include leading exchanges,
          banks, trading firms, and market makers. Additionally, Pyth Price data
          can be verified on 100+ blockchains.
        </p>
      </div>

      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          Product Options
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-8">
          Pyth offers two main versions of price feeds, each optimized for
          different use cases:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-12">
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

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          Additional Resources
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="p-6 bg-gray-50 dark:bg-darkGray rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2 text-lightForeground dark:text-white">
              Price Feed IDs
            </h3>
            <p className="text-gray-700 dark:text-light mb-4">
              Complete list of price feed IDs for both Pro and Core.
            </p>
            <a
              href="./price-feeds/core/price-feeds"
              className="text-lightLinks dark:text-darkLinks hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Pyth Core IDs →
            </a>
            <span className="mx-2 text-gray-400">|</span>
            <a
              href="./price-feeds/pro/price-feed-ids"
              className="text-lightLinks dark:text-darkLinks hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Pyth Pro IDs →
            </a>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-darkGray rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2 text-lightForeground dark:text-white">
              API Reference
            </h3>
            <p className="text-gray-700 dark:text-light mb-4">
              Complete API documentation for both Pro and Core.
            </p>
            <a
              href="./price-feeds/core/api-reference"
              className="text-lightLinks dark:text-darkLinks hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Core APIs →
            </a>
            <span className="mx-2 text-gray-400">|</span>
            <a
              href="./price-feeds/pro/api-reference"
              className="text-lightLinks dark:text-darkLinks hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Pro API →
            </a>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-darkGray rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2 text-lightForeground dark:text-white">
              Examples
            </h3>
            <p className="text-gray-700 dark:text-light mb-4">
              Sample applications and integration examples.
            </p>
            <a
              href="https://github.com/pyth-network/pyth-examples"
              className="text-lightLinks dark:text-darkLinks hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              View Examples →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
