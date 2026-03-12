"use client";

import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import type {
  RowConfig,
  SortDescriptor,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import { parseAsString, useQueryState } from "@pythnetwork/react-hooks/nuqs";
import { matchSorter } from "match-sorter";
import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo } from "react";
import { useCollator } from "react-aria";

import { Cluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { FeedKey } from "../FeedKey";
import {
  LiveConfidence,
  LivePrice,
  LiveValue,
  SKELETON_WIDTH,
} from "../LivePrices";
import { PriceName } from "../PriceName";
import styles from "./price-feeds-card.module.scss";

type Props = {
  id: string;
  priceFeeds: {
    symbol: string;
    exponent: number;
    numQuoters: number;
    assetClass: string;
    displaySymbol: string;
    key: string;
    description: string;
    icon: ReactNode;
  }[];
};

export const PriceFeedsCard = ({ priceFeeds, ...props }: Props) => (
  <Suspense fallback={<PriceFeedsCardContents isLoading {...props} />}>
    <ResolvedPriceFeedsCard priceFeeds={priceFeeds} {...props} />
  </Suspense>
);

const ResolvedPriceFeedsCard = ({ priceFeeds, ...props }: Props) => {
  const logger = useLogger();
  const collator = useCollator();
  const [assetClass, setAssetClass] = useQueryState(
    "assetClass",
    parseAsString.withDefault(""),
  );
  const feedsFilteredByAssetClass = useMemo(
    () =>
      assetClass
        ? priceFeeds.filter((feed) => feed.assetClass === assetClass)
        : priceFeeds,
    [assetClass, priceFeeds],
  );
  const {
    search,
    sortDescriptor,
    page,
    pageSize,
    updateSearch,
    updateSortDescriptor,
    updatePage,
    updatePageSize,
    paginatedItems,
    numResults,
    numPages,
    mkPageLink,
  } = useQueryParamFilterPagination(
    feedsFilteredByAssetClass,
    () => true,
    (a, b, { column, direction }) => {
      const field = column === "assetClass" ? "assetClass" : "displaySymbol";
      return (
        (direction === "descending" ? -1 : 1) *
        collator.compare(a[field], b[field])
      );
    },
    (items, search) => {
      return matchSorter(items, search, {
        keys: ["displaySymbol", "symbol", "description", "key"],
      });
    },
    { defaultSort: "priceFeedName" },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map(
        ({
          displaySymbol,
          symbol,
          exponent,
          numQuoters,
          key,
          description,
          icon,
          assetClass,
        }) => ({
          data: {
            assetClass: <AssetClassBadge>{assetClass}</AssetClassBadge>,
            confidenceInterval: (
              <LiveConfidence cluster={Cluster.Pythnet} feedKey={key} />
            ),
            exponent: (
              <LiveValue
                cluster={Cluster.Pythnet}
                defaultValue={exponent}
                feedKey={key}
                field="exponent"
              />
            ),
            numPublishers: (
              <LiveValue
                cluster={Cluster.Pythnet}
                defaultValue={numQuoters}
                feedKey={key}
                field="numQuoters"
              />
            ),
            price: <LivePrice cluster={Cluster.Pythnet} feedKey={key} />,
            priceFeedId: (
              <FeedKey className={styles.feedKey ?? ""} feedKey={key} />
            ),
            priceFeedName: (
              <SymbolPairTag
                className={styles.symbol}
                description={description}
                displaySymbol={displaySymbol}
                icon={icon}
              />
            ),
          },
          href: `/price-feeds/${encodeURIComponent(symbol)}`,
          id: symbol,
          textValue: displaySymbol,
        }),
      ),
    [paginatedItems],
  );

  const updateAssetClass = useCallback(
    (newAssetClass: string) => {
      updatePage(1);
      setAssetClass(newAssetClass).catch((error: unknown) => {
        logger.error("Failed to update asset class", error);
      });
    },
    [updatePage, setAssetClass, logger],
  );

  const assetClasses = useMemo(
    () =>
      [...new Set(priceFeeds.map((feed) => feed.assetClass))].sort((a, b) =>
        collator.compare(a, b),
      ),
    [priceFeeds, collator],
  );

  return (
    <PriceFeedsCardContents
      assetClass={assetClass}
      assetClasses={assetClasses}
      mkPageLink={mkPageLink}
      numPages={numPages}
      numResults={numResults}
      onAssetClassChange={updateAssetClass}
      onPageChange={updatePage}
      onPageSizeChange={updatePageSize}
      onSearchChange={updateSearch}
      onSortChange={updateSortDescriptor}
      page={page}
      pageSize={pageSize}
      rows={rows}
      search={search}
      sortDescriptor={sortDescriptor}
      {...props}
    />
  );
};

type PriceFeedsCardContents = Pick<Props, "id"> &
  (
    | { isLoading: true }
    | {
        isLoading?: false;
        numResults: number;
        search: string;
        sortDescriptor: SortDescriptor;
        onSortChange: (newSort: SortDescriptor) => void;
        assetClass: string;
        assetClasses: string[];
        numPages: number;
        page: number;
        pageSize: number;
        onSearchChange: (newSearch: string) => void;
        onAssetClassChange: (newAssetClass: string) => void;
        onPageSizeChange: (newPageSize: number) => void;
        onPageChange: (newPage: number) => void;
        mkPageLink: (page: number) => string;
        rows: (RowConfig<
          | "priceFeedName"
          | "assetClass"
          | "priceFeedId"
          | "price"
          | "confidenceInterval"
          | "exponent"
          | "numPublishers"
        > & { textValue: string })[];
      }
  );

const PriceFeedsCardContents = ({ id, ...props }: PriceFeedsCardContents) => (
  <Card
    className={styles.priceFeedsCard}
    icon={<ChartLine />}
    id={id}
    title={
      <>
        <span>Price Feeds</span>
        {!props.isLoading && (
          <Badge size="md" style="filled" variant="neutral">
            {props.numResults}
          </Badge>
        )}
      </>
    }
    toolbar={
      <>
        <SearchInput
          className={styles.searchInput ?? ""}
          placeholder="Feed symbol"
          size="sm"
          width={50}
          {...(props.isLoading
            ? { isDisabled: true, isPending: true }
            : {
                onChange: props.onSearchChange,
                value: props.search,
              })}
        />
        <Select
          hideLabel
          label="Asset Class"
          size="sm"
          variant="outline"
          {...(props.isLoading
            ? { buttonLabel: "Asset Class", isPending: true, options: [] }
            : {
                buttonLabel:
                  props.assetClass === "" ? "Asset Class" : props.assetClass,
                hideGroupLabel: true,
                onSelectionChange: props.onAssetClassChange,
                optionGroups: [
                  { name: "All", options: [{ id: "" }] },
                  {
                    name: "Asset classes",
                    options: props.assetClasses.map((id) => ({ id })),
                  },
                ],
                placement: "bottom end",
                selectedKey: props.assetClass,
                show: ({ id }) => (id === "" ? "All" : id),
              })}
        />
      </>
    }
    toolbarClassName={styles.toolbar}
    {...(!props.isLoading && {
      footer: (
        <Paginator
          currentPage={props.page}
          mkPageLink={props.mkPageLink}
          numPages={props.numPages}
          onPageChange={props.onPageChange}
          onPageSizeChange={props.onPageSizeChange}
          pageSize={props.pageSize}
        />
      ),
    })}
  >
    <EntityList
      className={styles.entityList ?? ""}
      fields={[
        { id: "assetClass", name: "Asset Class" },
        { id: "priceFeedId", name: "Price Feed ID" },
        { id: "confidenceInterval", name: "Confidence Interval" },
        { id: "exponent", name: "Exponent" },
        { id: "numPublishers", name: "# Publishers" },
      ]}
      headerLoadingSkeleton={<SymbolPairTag isLoading />}
      isLoading={props.isLoading}
      label="Price Feeds"
      rows={
        props.isLoading
          ? []
          : props.rows.map((row) => ({
              ...row,
              header: (
                <>
                  {row.data.priceFeedName}
                  {row.data.price}
                </>
              ),
            }))
      }
    />
    <Table
      className={styles.table ?? ""}
      columns={[
        {
          alignment: "left",
          allowsSorting: true,
          id: "priceFeedName",
          isRowHeader: true,
          loadingSkeleton: <SymbolPairTag isLoading />,
          name: "PRICE FEED",
        },
        {
          alignment: "left",
          allowsSorting: true,
          id: "assetClass",
          loadingSkeletonWidth: 20,
          name: "ASSET CLASS",
          width: 45,
        },
        {
          alignment: "left",
          id: "priceFeedId",
          loadingSkeletonWidth: 30,
          name: "PRICE FEED ID",
          width: 40,
        },
        {
          alignment: "right",
          id: "price",
          loadingSkeletonWidth: SKELETON_WIDTH,
          name: <PriceName uppercase />,
          width: 45,
        },
        {
          alignment: "left",
          id: "confidenceInterval",
          loadingSkeletonWidth: SKELETON_WIDTH,
          name: "CONFIDENCE INTERVAL",
          width: 45,
        },
        {
          alignment: "left",
          id: "exponent",
          name: "EXPONENT",
          width: 8,
        },
        {
          alignment: "left",
          id: "numPublishers",
          name: "# PUBLISHERS",
          width: 8,
        },
      ]}
      fill
      label="Price Feeds"
      rounded
      stickyHeader="appHeader"
      {...(props.isLoading
        ? {
            isLoading: true,
          }
        : {
            emptyState: (
              <NoResults
                onClearSearch={() => {
                  props.onSearchChange("");
                }}
                query={props.search}
              />
            ),
            onSortChange: props.onSortChange,
            rows: props.rows,
            sortDescriptor: props.sortDescriptor,
          })}
    />
  </Card>
);
