"use client";

import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { Table } from "@pythnetwork/component-library/Table";
import { type ReactNode, useMemo, useState } from "react";
import { useCollator, useFilter } from "react-aria";

import styles from "./coming-soon-list.module.scss";

type Props = {
  comingSoonFeeds: ComingSoonPriceFeed[];
};

type ComingSoonPriceFeed = {
  symbol: string;
  id: string;
  displaySymbol: string;
  assetClassAsString: string;
  priceFeedName: ReactNode;
  assetClass: ReactNode;
};

export const ComingSoonList = ({ comingSoonFeeds }: Props) => {
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const assetClasses = useMemo(
    () =>
      [
        ...new Set(
          comingSoonFeeds.map((priceFeed) => priceFeed.assetClassAsString),
        ),
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
        ? sortedFeeds.filter((feed) => feed.assetClassAsString === assetClass)
        : sortedFeeds,
    [assetClass, sortedFeeds],
  );
  const filteredFeeds = useMemo(
    () =>
      search === ""
        ? feedsFilteredByAssetClass
        : feedsFilteredByAssetClass.filter((feed) =>
            filter.contains(feed.symbol, search),
          ),
    [search, feedsFilteredByAssetClass, filter],
  );
  const rows = useMemo(
    () =>
      filteredFeeds.map(({ id, priceFeedName, assetClass }) => ({
        id,
        data: { priceFeedName, assetClass },
      })),
    [filteredFeeds],
  );
  return (
    <div className={styles.comingSoonList}>
      <div className={styles.searchBar}>
        <SearchInput
          size="sm"
          defaultValue={search}
          onChange={setSearch}
          width={40}
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
        divide
        label="Asset Classes"
        className={styles.priceFeeds ?? ""}
        columns={[
          {
            id: "priceFeedName",
            name: "PRICE FEED",
            isRowHeader: true,
            fill: true,
            alignment: "left",
          },
          { id: "assetClass", name: "ASSET CLASS", alignment: "right" },
        ]}
        rows={rows}
      />
    </div>
  );
};
