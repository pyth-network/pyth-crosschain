"use client";

import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import styles from "./index.module.scss";
import { SubscribeMenu } from "./SubscribeMenu";

type Tab = "updates" | "market-data";

const TABS: { key: Tab; label: string }[] = [
  { key: "updates", label: "Product updates" },
  { key: "market-data", label: "Market data" },
];

type HubTabsProps = {
  productUpdatesPanel: ReactNode;
  marketDataPanel: ReactNode;
  /** Dates present in the market-data stream, for legacy hash links. */
  marketDataDates: string[];
};

export const HubTabs = ({
  productUpdatesPanel,
  marketDataPanel,
  marketDataDates,
}: HubTabsProps) => {
  const router = useRouter();
  const pathname = usePathname();

  // Tab defaults to "updates" so its panel renders during the static prerender;
  // the URL-driven tab is reconciled from window.location after mount. Reading
  // useSearchParams during render would bail the panels out of the static HTML.
  const [tab, setTabState] = useState<Tab>("updates");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Legacy /price-feeds/changelog#<date> links redirect to /changelog with
    // the hash intact; when the hash names a market-data day, land on the
    // Market Data tab so the day view can scroll to it.
    const hash = window.location.hash.replace(/^#/, "");
    if (hash !== "" && marketDataDates.includes(hash)) {
      setTabState("market-data");
      if (params.get("tab") !== "market-data") {
        params.set("tab", "market-data");
        router.replace(
          `${pathname}?${params.toString()}${window.location.hash}`,
          { scroll: false },
        );
      }
      return;
    }
    setTabState(
      params.get("tab") === "market-data" ? "market-data" : "updates",
    );
  }, [marketDataDates, pathname, router]);

  const setTab = (next: Tab) => {
    setTabState(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "updates") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs === "" ? pathname : `${pathname}?${qs}`, {
      scroll: false,
    });
  };

  // Roving-tabindex keyboard support for the tablist (WAI-ARIA tabs pattern):
  // Arrow keys move between tabs (with automatic activation), Home/End jump to
  // the ends. Only the active tab is a tab stop; click still works as before.
  const onTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((t) => t.key === tab);
    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      }
      case "Home": {
        nextIndex = 0;
        break;
      }
      case "End": {
        nextIndex = TABS.length - 1;
        break;
      }
      default: {
        return;
      }
    }
    const nextKey = TABS[nextIndex]?.key;
    if (nextKey === undefined) {
      return;
    }
    event.preventDefault();
    setTab(nextKey);
    document.getElementById(`changelog-tab-${nextKey}`)?.focus();
  };

  return (
    <div className={styles.root}>
      <div className={styles.heroBar}>
        <div
          aria-label="Changelog feed"
          className={styles.tabToggle}
          onKeyDown={onTabListKeyDown}
          role="tablist"
        >
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                aria-controls="changelog-tabpanel"
                aria-selected={active}
                className={clsx(
                  styles.tabButton,
                  active && styles.tabButtonActive,
                )}
                id={`changelog-tab-${key}`}
                key={key}
                onClick={() => {
                  setTab(key);
                }}
                role="tab"
                tabIndex={active ? 0 : -1}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
        {tab === "updates" && <SubscribeMenu />}
      </div>

      <div
        aria-labelledby={`changelog-tab-${tab}`}
        id="changelog-tabpanel"
        role="tabpanel"
      >
        {tab === "updates" ? productUpdatesPanel : marketDataPanel}
      </div>
    </div>
  );
};
