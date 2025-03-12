"use client";

import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { Table } from "@pythnetwork/component-library/Table";
import { useMemo, useState } from "react";
import { useCollator, useFilter } from "react-aria";

import styles from "./coming-soon-list.module.scss";
import { usePriceFeeds } from "../../hooks/use-price-feeds";
import { AssetClassTag } from "../AssetClassTag";
import { NoResults } from "../NoResults";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  comingSoonSymbols: string[];
};

export const ComingSoonList = ({ comingSoonSymbols }: Props) => {
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const feeds = usePriceFeeds();
  const comingSoonFeeds = useMemo(
    () =>
      comingSoonSymbols.map((symbol) => {
        const feed = feeds.get(symbol);
        if (feed) {
          return {
            symbol,
            assetClass: feed.assetClass,
            displaySymbol: feed.displaySymbol,
          };
        } else {
          throw new NoSuchFeedError(symbol);
        }
      }),
    [feeds, comingSoonSymbols],
  );
  const assetClasses = useMemo(
    () =>
      [
        ...new Set(comingSoonFeeds.map((priceFeed) => priceFeed.assetClass)),
      ].sort((a, b) => collator.compare(a, b)),
    [comingSoonFeeds, collator],
  );
  const sortedFeeds = useMemo(
    () =>
      comingSoonFeeds.sort((a, b) =>
        collator.compare(a.displaySymbol, b.displaySymbol),
      ),
    [collator, comingSoonFeeds],
  );
  const feedsFilteredByAssetClass = useMemo(
    () =>
      assetClass
        ? sortedFeeds.filter((feed) => feed.assetClass === assetClass)
        : sortedFeeds,
    [assetClass, sortedFeeds],
  );
  const filteredFeeds = useMemo(
    () =>
      search === ""
        ? feedsFilteredByAssetClass
        : feedsFilteredByAssetClass.filter((feed) =>
            filter.contains(feed.displaySymbol, search),
          ),
    [search, feedsFilteredByAssetClass, filter],
  );
  const rows = useMemo(
    () =>
      filteredFeeds.map(({ symbol }) => ({
        id: symbol,
        href: `/price-feeds/${encodeURIComponent(symbol)}`,
        data: {
          priceFeedName: <PriceFeedTag compact symbol={symbol} />,
          assetClass: <AssetClassTag symbol={symbol} />,
        },
      })),
    [filteredFeeds],
  );
  return (
    <div className={styles.comingSoonList}>
      <div className={styles.searchBar}>
        <SearchInput
          size="sm"
          value={search}
          onChange={setSearch}
          width={50}
          placeholder="Feed symbol"
        />
        <Select
          optionGroups={[
            { name: "All", options: [""] },
            { name: "Asset classes", options: assetClasses },
          ]}
          hideGroupLabel
          show={(value) => (value === "" ? "All" : value)}
          placement="bottom end"
          selectedKey={assetClass}
          onSelectionChange={setAssetClass}
          label="Asset Class"
          size="sm"
          variant="outline"
          hideLabel
          buttonLabel={assetClass === "" ? "Asset Class" : assetClass}
        />
      </div>
      <Table
        fill
        stickyHeader
        label="Coming Soon"
        className={styles.priceFeeds ?? ""}
        emptyState={
          <NoResults
            query={search}
            onClearSearch={() => {
              setSearch("");
            }}
          />
        }
        columns={[
          {
            id: "priceFeedName",
            name: "PRICE FEED",
            isRowHeader: true,
            alignment: "left",
          },
          {
            id: "assetClass",
            name: "ASSET CLASS",
            alignment: "right",
            width: 40,
          },
        ]}
        rows={rows}
      />
    </div>
  );
};

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
