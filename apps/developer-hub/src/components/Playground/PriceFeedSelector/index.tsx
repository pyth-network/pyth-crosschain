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

export function PriceFeedSelector({ className }: PriceFeedSelectorProps) {
  const { config, updateConfig } = usePlaygroundContext();
  const feedsState = usePriceFeeds();
  const [search, setSearch] = useState("");

  const selectedIds = config.priceFeedIds;

  const filteredFeeds = useMemo(() => {
    if (feedsState.status !== "loaded") return [];

    const searchLower = search.toLowerCase().trim();
    if (!searchLower) {
      return feedsState.feeds.slice(0, 50); // Show first 50 by default
    }

    return feedsState.feeds
      .filter(
        (feed) =>
          feed.symbol.toLowerCase().includes(searchLower) ||
          feed.name.toLowerCase().includes(searchLower) ||
          String(feed.id).includes(searchLower),
      )
      .slice(0, 50);
  }, [feedsState, search]);

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
