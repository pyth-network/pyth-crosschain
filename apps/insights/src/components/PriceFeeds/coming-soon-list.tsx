"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { Table } from "@pythnetwork/component-library/Table";
import { type ReactNode, useMemo, useState } from "react";
import { useCollator, useFilter } from "react-aria";

import styles from "./coming-soon-list.module.scss";
import { NoResults } from "../NoResults";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  comingSoonFeeds: ComingSoonPriceFeed[];
};

type ComingSoonPriceFeed = {
  id: string;
  displaySymbol: string;
  icon: ReactNode;
  assetClass: string;
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
      filteredFeeds.map(({ id, displaySymbol, assetClass, icon }) => ({
        id,
        data: {
          priceFeedName: (
            <PriceFeedTag compact symbol={displaySymbol} icon={icon} />
          ),
          assetClass: (
            <Badge variant="neutral" style="outline" size="xs">
              {assetClass.toUpperCase()}
            </Badge>
          ),
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
