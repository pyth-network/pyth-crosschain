"use client";

import { NoResults } from "@pythnetwork/component-library/NoResults";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import { Table } from "@pythnetwork/component-library/Table";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useCollator, useFilter } from "react-aria";
import { AssetClassBadge } from "../AssetClassBadge";
import styles from "./coming-soon-list.module.scss";

type Props = {
  comingSoonFeeds: {
    symbol: string;
    assetClass: string;
    displaySymbol: string;
    description: string;
    icon: ReactNode;
  }[];
};

export const ComingSoonList = ({ comingSoonFeeds }: Props) => {
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
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
      filteredFeeds.map(
        ({ symbol, assetClass, description, displaySymbol, icon }) => ({
          data: {
            assetClass: <AssetClassBadge>{assetClass}</AssetClassBadge>,
            priceFeedName: (
              <SymbolPairTag
                description={description}
                displaySymbol={displaySymbol}
                icon={icon}
              />
            ),
          },
          href: `/price-feeds/${encodeURIComponent(symbol)}`,
          id: symbol,
        }),
      ),
    [filteredFeeds],
  );

  return (
    <div className={styles.comingSoonList}>
      <div className={styles.searchBar}>
        <SearchInput
          onChange={setSearch}
          placeholder="Feed symbol"
          size="sm"
          value={search}
          width={50}
        />
        <Select
          buttonLabel={assetClass === "" ? "Asset Class" : assetClass}
          hideGroupLabel
          hideLabel
          label="Asset Class"
          onSelectionChange={setAssetClass}
          optionGroups={[
            { name: "All", options: [{ id: "" }] },
            {
              name: "Asset classes",
              options: assetClasses.map((id) => ({ id })),
            },
          ]}
          placement="bottom end"
          selectedKey={assetClass}
          show={({ id }) => (id === "" ? "All" : id)}
          size="sm"
          variant="outline"
        />
      </div>
      <Table
        className={styles.priceFeeds ?? ""}
        columns={[
          {
            alignment: "left",
            id: "priceFeedName",
            isRowHeader: true,
            name: "PRICE FEED",
          },
          {
            alignment: "right",
            id: "assetClass",
            name: "ASSET CLASS",
            width: 40,
          },
        ]}
        emptyState={
          <NoResults
            onClearSearch={() => {
              setSearch("");
            }}
            query={search}
          />
        }
        fill
        label="Coming Soon"
        rows={rows}
        stickyHeader="top"
      />
    </div>
  );
};
