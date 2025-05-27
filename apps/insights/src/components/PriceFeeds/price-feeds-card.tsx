"use client";

import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import type {
  RowConfig,
  SortDescriptor,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryState, parseAsString } from "nuqs";
import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo } from "react";
import { useFilter, useCollator } from "react-aria";

import styles from "./price-feeds-card.module.scss";
import { useQueryParamFilterPagination } from "../../hooks/use-query-param-filter-pagination";
import { Cluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { FeedKey } from "../FeedKey";
import {
  SKELETON_WIDTH,
  LivePrice,
  LiveConfidence,
  LiveValue,
} from "../LivePrices";
import { PriceFeedTag } from "../PriceFeedTag";
import { PriceName } from "../PriceName";

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
  const filter = useFilter({ sensitivity: "base", usage: "search" });
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
    (priceFeed, search) => filter.contains(priceFeed.displaySymbol, search),
    (a, b, { column, direction }) => {
      const field = column === "assetClass" ? "assetClass" : "displaySymbol";
      return (
        (direction === "descending" ? -1 : 1) *
        collator.compare(a[field], b[field])
      );
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
          id: symbol,
          href: `/price-feeds/${encodeURIComponent(symbol)}`,
          textValue: displaySymbol,
          data: {
            exponent: (
              <LiveValue
                field="exponent"
                feedKey={key}
                defaultValue={exponent}
                cluster={Cluster.Pythnet}
              />
            ),
            numPublishers: (
              <LiveValue
                field="numQuoters"
                feedKey={key}
                defaultValue={numQuoters}
                cluster={Cluster.Pythnet}
              />
            ),
            price: <LivePrice feedKey={key} cluster={Cluster.Pythnet} />,
            confidenceInterval: (
              <LiveConfidence feedKey={key} cluster={Cluster.Pythnet} />
            ),
            priceFeedName: (
              <PriceFeedTag
                description={description}
                displaySymbol={displaySymbol}
                icon={icon}
              />
            ),
            assetClass: <AssetClassBadge>{assetClass}</AssetClassBadge>,
            priceFeedId: (
              <FeedKey feedKey={key} className={styles.feedKey ?? ""} />
            ),
          },
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
      numResults={numResults}
      search={search}
      sortDescriptor={sortDescriptor}
      assetClass={assetClass}
      assetClasses={assetClasses}
      numPages={numPages}
      page={page}
      pageSize={pageSize}
      onSearchChange={updateSearch}
      onSortChange={updateSortDescriptor}
      onAssetClassChange={updateAssetClass}
      onPageSizeChange={updatePageSize}
      onPageChange={updatePage}
      mkPageLink={mkPageLink}
      rows={rows}
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
    id={id}
    icon={<ChartLine />}
    className={styles.priceFeedsCard}
    title={
      <>
        <span>Price Feeds</span>
        {!props.isLoading && (
          <Badge style="filled" variant="neutral" size="md">
            {props.numResults}
          </Badge>
        )}
      </>
    }
    toolbarClassName={styles.toolbar}
    toolbar={
      <>
        <SearchInput
          size="sm"
          width={50}
          placeholder="Feed symbol"
          className={styles.searchInput ?? ""}
          {...(props.isLoading
            ? { isPending: true, isDisabled: true }
            : {
                value: props.search,
                onChange: props.onSearchChange,
              })}
        />
        <Select
          label="Asset Class"
          size="sm"
          variant="outline"
          hideLabel
          {...(props.isLoading
            ? { isPending: true, options: [], buttonLabel: "Asset Class" }
            : {
                optionGroups: [
                  { name: "All", options: [{ id: "" }] },
                  {
                    name: "Asset classes",
                    options: props.assetClasses.map((id) => ({ id })),
                  },
                ],
                hideGroupLabel: true,
                show: ({ id }) => (id === "" ? "All" : id),
                placement: "bottom end",
                buttonLabel:
                  props.assetClass === "" ? "Asset Class" : props.assetClass,
                selectedKey: props.assetClass,
                onSelectionChange: props.onAssetClassChange,
              })}
        />
      </>
    }
    {...(!props.isLoading && {
      footer: (
        <Paginator
          numPages={props.numPages}
          currentPage={props.page}
          onPageChange={props.onPageChange}
          pageSize={props.pageSize}
          onPageSizeChange={props.onPageSizeChange}
          pageSizeOptions={[10, 20, 30, 40, 50]}
          mkPageLink={props.mkPageLink}
        />
      ),
    })}
  >
    <EntityList
      label="Price Feeds"
      className={styles.entityList ?? ""}
      headerLoadingSkeleton={<PriceFeedTag isLoading />}
      fields={[
        { id: "assetClass", name: "Asset Class" },
        { id: "priceFeedId", name: "Price Feed ID" },
        { id: "confidenceInterval", name: "Confidence Interval" },
        { id: "exponent", name: "Exponent" },
        { id: "numPublishers", name: "# Publishers" },
      ]}
      isLoading={props.isLoading}
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
      rounded
      fill
      label="Price Feeds"
      stickyHeader="appHeader"
      className={styles.table ?? ""}
      columns={[
        {
          id: "priceFeedName",
          name: "PRICE FEED",
          isRowHeader: true,
          alignment: "left",
          loadingSkeleton: <PriceFeedTag isLoading />,
          allowsSorting: true,
        },
        {
          id: "assetClass",
          name: "ASSET CLASS",
          alignment: "left",
          width: 75,
          loadingSkeletonWidth: 20,
          allowsSorting: true,
        },
        {
          id: "priceFeedId",
          name: "PRICE FEED ID",
          alignment: "left",
          width: 50,
          loadingSkeletonWidth: 30,
        },
        {
          id: "price",
          name: <PriceName uppercase />,
          alignment: "right",
          width: 40,
          loadingSkeletonWidth: SKELETON_WIDTH,
        },
        {
          id: "confidenceInterval",
          name: "CONFIDENCE INTERVAL",
          alignment: "left",
          width: 50,
          loadingSkeletonWidth: SKELETON_WIDTH,
        },
        {
          id: "exponent",
          name: "EXPONENT",
          alignment: "left",
          width: 8,
        },
        {
          id: "numPublishers",
          name: "# PUBLISHERS",
          alignment: "left",
          width: 8,
        },
      ]}
      {...(props.isLoading
        ? {
            isLoading: true,
          }
        : {
            rows: props.rows,
            sortDescriptor: props.sortDescriptor,
            onSortChange: props.onSortChange,
            emptyState: (
              <NoResults
                query={props.search}
                onClearSearch={() => {
                  props.onSearchChange("");
                }}
              />
            ),
          })}
    />
  </Card>
);
