"use client"

import { TabList } from "@pythnetwork/component-library/TabList"
import { Tabs as UnstyledTabs } from "@pythnetwork/component-library/unstyled/Tabs"
import { Button } from "@pythnetwork/component-library/Button"
import { ArrowRight as ArrowRightIcon } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

type TabId = "pull" | "pusher" | "historical"

export function ArchitectureTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("pull")

  function renderDiagram() {
    if (activeTab === "historical") {
      return (
        <div className="flex items-center justify-center gap-6 p-6">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-gray-700 dark:text-gray-300">Historical Data</div>
          </div>
        </div>
      )
    }

    const nodes = activeTab === "pull"
      ? ["Publishers", "Pythnet", "User", "Your Contract"]
      : ["Publishers", "Pythnet", "Price Pusher", "Your Contract"]

    return (
      <div className="w-full overflow-x-auto">
        <svg role="img" aria-label="Data flow diagram" className="w-full max-w-2xl mx-auto" height="160" viewBox="0 0 800 160">
          {nodes.map((label, i) => {
            const x = 80 + i * 240
            return (
              <g key={label}>
                <rect x={x - 70} y={40} width={140} height={56} rx={12} className="fill-white dark:fill-[#0B0F1A] stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
                <text x={x} y={72} textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="14">{label}</text>
              </g>
            )
          })}
          {[0,1,2].map(i => {
            const x1 = 80 + i * 240 + 70
            const x2 = 80 + (i+1) * 240 - 70
            const points = `${String(x2 - 10)},63 ${String(x2 - 10)},73 ${String(x2)},68`
            return (
              <g key={i}>
                <line x1={x1} y1={68} x2={x2} y2={68} className="stroke-blue-500" strokeWidth={2} />
                <polygon points={points} className="fill-blue-500" />
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  function renderContent() {
    if (activeTab === "pull") return (
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          Publishers stream signed updates to Pythnet roughly every 400 ms. Your app pulls and verifies
          prices on demand, then your contract updates via <code className="font-mono">updatePriceFeeds</code>.
        </p>
        <Button isDisabled className="inline-flex items-center gap-2 px-4 py-2">
          Read Pull Integration Guide
          <ArrowRightIcon size={18} />
        </Button>
      </div>
    )

    if (activeTab === "pusher") return (
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          Automate on-chain updates using a Price Pusher. It listens to Pythnet and pushes fresh prices to
          your contracts on your chosen schedule and conditions.
        </p>
        <Button isDisabled className="inline-flex items-center gap-2 px-4 py-2">
          Deploy a Price Pusher
          <ArrowRightIcon size={18} />
        </Button>
      </div>
    )

    if (activeTab === "historical") return (
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          Explore cryptographically verifiable historical prices for auditing, analytics, and backtesting.
        </p>
        <Button isDisabled className="inline-flex items-center gap-2 px-4 py-2">
          Explore Historical Prices
          <ArrowRightIcon size={18} />
        </Button>
      </div>
    )

    return null
  }

  const items = [
    { id: "pull", href: "#pull", children: "Pull", onPress: () => { setActiveTab("pull") } },
    { id: "pusher", href: "#pusher", children: "Price Pusher", onPress: () => { setActiveTab("pusher") } },
    { id: "historical", href: "#historical", children: "Historical", onPress: () => { setActiveTab("historical") } },
  ]

  return (
    <div>
      <UnstyledTabs selectedKey={activeTab}>
        <TabList label="Architecture" currentTab={activeTab} items={items} className="flex gap-2 border-b border-gray-200 dark:border-gray-800" />
      </UnstyledTabs>

      <div className="pt-8 space-y-6">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-[#0B0F1A]">
          {renderDiagram()}
        </div>
        <div>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}


