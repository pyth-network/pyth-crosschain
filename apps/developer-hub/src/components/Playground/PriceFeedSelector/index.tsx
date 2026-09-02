"use client";

import { X } from "@phosphor-icons/react/dist/ssr/X";
import { Button } from "@pythnetwork/component-library/Button";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { usePlaygroundContext } from "../PlaygroundContext";
import styles from "./index.module.scss";
import { usePriceFeeds } from "./use-price-feeds";

type PriceFeedSelectorProps = {
  className?: string;
};

type CategoryConfig = {
  id: string;
  label: string;
  assetTypes: string[];
};

// Asset types that should be merged into a single category.
// Any asset type NOT listed here gets its own tab automatically.
const ASSET_TYPE_GROUPS: Record<string, string[]> = {
  crypto: ["crypto", "crypto-index"],
};

// Display labels for known category IDs.
// Unknown types are auto-labeled by title-casing (e.g., "my-type" → "My Type").
const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Commodity",
  crypto: "Crypto",
  "crypto-redemption-rate": "Redemption Rates",
  custom: "Custom",
  equity: "Equity",
  "funding-rate": "Funding Rate",
  fx: "FX",
  kalshi: "Kalshi",
  metal: "Metal",
  nav: "NAV",
  rates: "Rates",
};

function formatCategoryLabel(id: string): string {
  return (
    CATEGORY_LABELS[id] ??
    id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/**
 * Derives categories dynamically from the feeds' asset_type values.
 * Groups related types (e.g. crypto + crypto-index) and auto-discovers
 * new asset classes without code changes.
 */
function buildCategories(feeds: { assetType: string }[]): CategoryConfig[] {
  const allAssetTypes = new Set(feeds.map((f) => f.assetType));

  // Build reverse map: asset_type → category id
  const assetTypeToCategory = new Map<string, string>();
  for (const [categoryId, groupedTypes] of Object.entries(ASSET_TYPE_GROUPS)) {
    for (const type of groupedTypes) {
      assetTypeToCategory.set(type, categoryId);
    }
  }

  // Collect asset types per category
  const categoryMap = new Map<string, string[]>();
  for (const assetType of allAssetTypes) {
    const categoryId = assetTypeToCategory.get(assetType) ?? assetType;
    const existing = categoryMap.get(categoryId) ?? [];
    existing.push(assetType);
    categoryMap.set(categoryId, existing);
  }

  // Sort categories by feed count (largest first)
  const sorted = [...categoryMap.entries()].sort((a, b) => {
    const countA = feeds.filter((f) => a[1].includes(f.assetType)).length;
    const countB = feeds.filter((f) => b[1].includes(f.assetType)).length;
    return countB - countA;
  });

  const categories: CategoryConfig[] = [
    { assetTypes: [], id: "all", label: "All" },
  ];
  for (const [id, assetTypes] of sorted) {
    categories.push({ assetTypes, id, label: formatCategoryLabel(id) });
  }

  return categories;
}

export function PriceFeedSelector({ className }: PriceFeedSelectorProps) {
  const { config, updateConfig } = usePlaygroundContext();
  const feedsState = usePriceFeeds();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const selectedIds = config.priceFeedIds;

  // Derive categories dynamically from feeds
  const categories = useMemo(() => {
    if (feedsState.status !== "loaded") {
      return [{ assetTypes: [] as string[], id: "all", label: "All" }];
    }
    return buildCategories(feedsState.feeds);
  }, [feedsState]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    if (feedsState.status !== "loaded") {
      return new Map<string, number>();
    }

    const counts = new Map<string, number>();
    for (const category of categories) {
      if (category.id === "all") {
        counts.set("all", feedsState.feeds.length);
      } else {
        const count = feedsState.feeds.filter((feed) =>
          category.assetTypes.includes(feed.assetType),
        ).length;
        counts.set(category.id, count);
      }
    }

    return counts;
  }, [feedsState, categories]);

  const filteredFeeds = useMemo(() => {
    if (feedsState.status !== "loaded") return [];

    const activeCategoryConfig = categories.find(
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
  }, [feedsState, search, activeCategory, categories]);

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
            <div className={styles.chip} key={feed.id}>
              <span className={styles.chipText}>
                {feed.symbol} ({feed.id})
              </span>
              <button
                aria-label={`Remove ${feed.symbol}`}
                className={styles.chipRemove}
                onClick={() => {
                  handleRemoveFeed(feed.id);
                }}
                type="button"
              >
                <X weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <SearchInput
        className={styles.searchInput ?? ""}
        label="Search price feeds"
        onChange={setSearch}
        placeholder="Search by symbol, name, or ID..."
        value={search}
      />

      {/* Category tabs */}
      <div className={styles.categoryTabs}>
        {categories.map((category) => {
          const count = categoryCounts.get(category.id) ?? 0;
          const formattedCount =
            count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
          return (
            <button
              className={clsx(styles.categoryTab, {
                [styles.active ?? ""]: activeCategory === category.id,
              })}
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id);
              }}
              type="button"
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
            <Spinner isIndeterminate label="Loading price feeds..." />
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
                className={styles.feedItem ?? ""}
                key={feed.id}
                onPress={() => {
                  handleToggleFeed(feed.id);
                }}
                size="sm"
                variant={isSelected ? "primary" : "outline"}
              >
                <span className={styles.feedSymbol}>{feed.symbol}</span>
                <span className={styles.feedId}>({feed.id})</span>
              </Button>
            );
          })}
      </div>

      <a
        className={styles.link}
        href="/price-feeds/pro/price-feed-ids"
        rel="noopener noreferrer"
        target="_blank"
      >
        View all Price Feed IDs →
      </a>
    </div>
  );
}
