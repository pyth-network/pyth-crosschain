"use client";

import { X } from "@phosphor-icons/react/dist/ssr/X";
import { Button } from "@pythnetwork/component-library/Button";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import clsx from "clsx";
import { useMemo, useState } from "react";

import styles from "./index.module.scss";
import { usePriceFeeds } from "./use-price-feeds";
import { usePlaygroundContext } from "../PlaygroundContext";

type PriceFeedSelectorProps = {
  className?: string;
};

type CategoryId =
  | "all"
  | "crypto"
  | "equity"
  | "fx"
  | "rates"
  | "commodity"
  | "kalshi"
  | "nav";

type CategoryConfig = {
  id: CategoryId;
  label: string;
  assetTypes: string[];
};

// TODO: Derive categories dynamically from the API response instead of hardcoding.
// The feeds API returns `asset_type` for each feed, so we could:
// 1. Extract unique asset types from feedsState.feeds
// 2. Group related types (e.g., "crypto-index" with "crypto")
// 3. Generate tabs dynamically with accurate counts
// This would auto-discover new asset classes without code changes.
const CATEGORIES: CategoryConfig[] = [
  { id: "all", label: "All", assetTypes: [] },
  { id: "crypto", label: "Crypto", assetTypes: ["crypto", "crypto-index"] },
  { id: "equity", label: "Equity", assetTypes: ["equity"] },
  { id: "fx", label: "FX", assetTypes: ["fx"] },
  {
    id: "rates",
    label: "Rates",
    assetTypes: ["rates", "crypto-redemption-rate", "funding-rate"],
  },
  { id: "commodity", label: "Commodity", assetTypes: ["commodity", "metal"] },
  { id: "kalshi", label: "Kalshi", assetTypes: ["kalshi"] },
  { id: "nav", label: "NAV", assetTypes: ["nav"] },
];

export function PriceFeedSelector({ className }: PriceFeedSelectorProps) {
  const { config, updateConfig } = usePlaygroundContext();
  const feedsState = usePriceFeeds();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");

  const selectedIds = config.priceFeedIds;

  // Compute category counts
  const categoryCounts = useMemo(() => {
    if (feedsState.status !== "loaded") {
      return new Map<CategoryId, number>();
    }

    const counts = new Map<CategoryId, number>();
    const categoryMap = new Map<string, CategoryId>();

    // Build map of asset type to category
    for (const category of CATEGORIES) {
      if (category.id === "all") {
        counts.set("all", feedsState.feeds.length);
      } else {
        for (const assetType of category.assetTypes) {
          categoryMap.set(assetType, category.id);
        }
      }
    }

    // Count feeds per category
    for (const category of CATEGORIES) {
      if (category.id !== "all") {
        const count = feedsState.feeds.filter((feed) =>
          category.assetTypes.includes(feed.assetType),
        ).length;
        counts.set(category.id, count);
      }
    }

    return counts;
  }, [feedsState]);

  const filteredFeeds = useMemo(() => {
    if (feedsState.status !== "loaded") return [];

    const activeCategoryConfig = CATEGORIES.find(
      (cat) => cat.id === activeCategory,
    );
    if (!activeCategoryConfig) return [];

    // Filter by category
    let categoryFiltered = feedsState.feeds;
    if (activeCategory !== "all") {
      categoryFiltered = feedsState.feeds.filter((feed) =>
        activeCategoryConfig.assetTypes.includes(feed.assetType),
      );
    }

    // Filter by search
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) {
      return categoryFiltered.slice(0, 50); // Show first 50 by default
    }

    return categoryFiltered
      .filter(
        (feed) =>
          feed.symbol.toLowerCase().includes(searchLower) ||
          feed.name.toLowerCase().includes(searchLower) ||
          String(feed.id).includes(searchLower),
      )
      .slice(0, 50);
  }, [feedsState, search, activeCategory]);

  const selectedFeeds = useMemo(() => {
    if (feedsState.status !== "loaded") return [];
    return feedsState.feeds.filter((feed) => selectedIds.includes(feed.id));
  }, [feedsState, selectedIds]);

  const handleToggleFeed = (feedId: number) => {
    if (selectedIds.includes(feedId)) {
      updateConfig({ priceFeedIds: selectedIds.filter((id) => id !== feedId) });
    } else {
      updateConfig({ priceFeedIds: [...selectedIds, feedId] });
    }
  };

  const handleRemoveFeed = (feedId: number) => {
    updateConfig({ priceFeedIds: selectedIds.filter((id) => id !== feedId) });
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.label}>Price Feeds</span>
        <span className={styles.count}>{selectedIds.length} selected</span>
      </div>

      {/* Selected feeds chips */}
      {selectedFeeds.length > 0 && (
        <div className={styles.selectedChips}>
          {selectedFeeds.map((feed) => (
            <div key={feed.id} className={styles.chip}>
              <span className={styles.chipText}>
                {feed.symbol} ({feed.id})
              </span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => {
                  handleRemoveFeed(feed.id);
                }}
                aria-label={`Remove ${feed.symbol}`}
              >
                <X weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <SearchInput
        label="Search price feeds"
        placeholder="Search by symbol, name, or ID..."
        value={search}
        onChange={setSearch}
        className={styles.searchInput ?? ""}
      />

      {/* Category tabs */}
      <div className={styles.categoryTabs}>
        {CATEGORIES.map((category) => {
          const count = categoryCounts.get(category.id) ?? 0;
          const formattedCount =
            count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
          return (
            <button
              key={category.id}
              type="button"
              className={clsx(styles.categoryTab, {
                [styles.active ?? ""]: activeCategory === category.id,
              })}
              onClick={() => {
                setActiveCategory(category.id);
              }}
            >
              <span className={styles.tabLabel}>{category.label}</span>
              {count > 0 && (
                <span className={styles.tabCount}>{formattedCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feed list */}
      <div className={styles.feedList}>
        {feedsState.status === "loading" && (
          <div className={styles.loading}>
            <Spinner label="Loading price feeds..." isIndeterminate />
          </div>
        )}

        {feedsState.status === "error" && (
          <div className={styles.error}>{feedsState.error}</div>
        )}

        {feedsState.status === "loaded" && filteredFeeds.length === 0 && (
          <div className={styles.empty}>No price feeds found</div>
        )}

        {feedsState.status === "loaded" &&
          filteredFeeds.map((feed) => {
            const isSelected = selectedIds.includes(feed.id);
            return (
              <Button
                key={feed.id}
                variant={isSelected ? "primary" : "outline"}
                size="sm"
                className={styles.feedItem ?? ""}
                onPress={() => {
                  handleToggleFeed(feed.id);
                }}
              >
                <span className={styles.feedSymbol}>{feed.symbol}</span>
                <span className={styles.feedId}>({feed.id})</span>
              </Button>
            );
          })}
      </div>

      <a
        href="/price-feeds/pro/price-feed-ids"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        View all Price Feed IDs →
      </a>
    </div>
  );
}
