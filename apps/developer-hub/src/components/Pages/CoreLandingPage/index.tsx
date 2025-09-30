"use client";

import { ArrowRight as ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";

import { ArchitectureTabs } from "../../Core/architecture-tabs";

export function CoreLandingPage() {
  return (
    <div className="min-h-screen">
      <section>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Real-Time Market Data, On-Chain
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              Pyth Core delivers sub-second, signed prices across 100+
              blockchains. Fetch live data, automate updates using Price Pusher,
              and parse historical prices—all from one oracle network.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                isDisabled
                className="inline-flex items-center gap-2 px-5 py-3"
              >
                Get started by pulling prices
                <ArrowRightIcon size={18} />
              </Button>
              <Button
                isDisabled
                className="inline-flex items-center gap-2 px-5 py-3 border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Set up a Price Pusher
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-darkGray">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="sr-only">What is Pyth Core?</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            Pyth Core provides high-frequency, cryptographically signed price
            feeds that you can verify on-chain. Publishers stream updates to
            Pythnet roughly every 400 ms. Your dApp pulls and verifies prices
            whenever you need them.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-[#0B0F1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Integration Styles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Pull Oracle
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The default approach: your dApp fetches and verifies prices
                on-demand whenever needed.
              </p>
              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector("#architecture-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                Learn More →
              </button>
            </div>
            <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Sponsored Updates
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Automate price updates using a Price Pusher for push-like
                functionality with your own gas sponsorship.
              </p>
              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector("#architecture-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                Learn More →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="architecture-section"
        className="bg-gray-50 dark:bg-[#0B0F1A]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            How it works
          </h2>
          <ArchitectureTabs />
        </div>
      </section>

      <section className="bg-white dark:bg-darkGray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            Why Pyth Core
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Sub-second Data
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Get signed prices refreshed every ~400 ms.
              </p>
            </div>
            <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Verifiable
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                On-chain signature verification for trustless data.
              </p>
            </div>
            <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Flexible Integration
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Pull on demand or automate with a Price Pusher.
              </p>
            </div>
            <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0F1A]">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Historical Archive
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Audit and backtest with cryptographically secure history.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
