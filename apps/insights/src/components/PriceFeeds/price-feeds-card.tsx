"use client";

import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { useLogger } from "@pythnetwork/app-logger";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import {
  type RowConfig,
  type SortDescriptor,
  Table,
} from "@pythnetwork/component-library/Table";
import { useQueryState, parseAsString } from "nuqs";
import { type ReactNode, Suspense, useCallback, useMemo } from "react";
import { useFilter, useCollator } from "react-aria";

import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";
import { FeedKey } from "../FeedKey";
import {
  SKELETON_WIDTH,
  LivePrice,
  LiveConfidence,
  LiveValue,
} from "../LivePrices";
import { NoResults } from "../NoResults";
import { PriceFeedTag } from "../PriceFeedTag";
import rootStyles from "../Root/index.module.scss";

type Props = {
  id: string;
  priceFeeds: PriceFeed[];
};

type PriceFeed = {
  icon: ReactNode;
  symbol: string;
  id: string;
  displaySymbol: string;
  assetClass: string;
  exponent: number;
  numQuoters: number;
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
    (priceFeed, search) => {
      const searchTokens = search
        .split(" ")
        .flatMap((item) => item.split(","))
        .filter(Boolean);
      return searchTokens.some((token) =>
        filter.contains(priceFeed.displaySymbol, token),
      );
    },
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
          icon,
          id,
          symbol,
          displaySymbol,
          exponent,
          numQuoters,
          assetClass,
        }) => ({
          id,
          href: `/price-feeds/${encodeURIComponent(symbol)}`,
          data: {
            exponent: (
              <LiveValue
                field="exponent"
                feedKey={id}
                defaultValue={exponent}
              />
            ),
            numPublishers: (
              <LiveValue
                field="numQuoters"
                feedKey={id}
                defaultValue={numQuoters}
              />
            ),
            price: <LivePrice feedKey={id} />,
            confidenceInterval: <LiveConfidence feedKey={id} />,
            priceFeedName: (
              <PriceFeedTag compact symbol={displaySymbol} icon={icon} />
            ),
            assetClass: (
              <Badge variant="neutral" style="outline" size="xs">
                {assetClass.toUpperCase()}
              </Badge>
            ),
            priceFeedId: (
              <FeedKey
                // className={styles.feedKey ?? ""}
                size="xs"
                variant="ghost"
                feedKey={id}
              />
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
        rows: RowConfig<
          | "priceFeedName"
          | "assetClass"
          | "priceFeedId"
          | "price"
          | "confidenceInterval"
          | "exponent"
          | "numPublishers"
        >[];
      }
  );

const PriceFeedsCardContents = ({ id, ...props }: PriceFeedsCardContents) => (
  <Card
    id={id}
    icon={<ChartLine />}
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
    toolbar={
      <>
        <Select<string>
          label="Asset Class"
          size="sm"
          variant="outline"
          hideLabel
          {...(props.isLoading
            ? { isPending: true, options: [], buttonLabel: "Asset Class" }
            : {
                optionGroups: [
                  { name: "All", options: [""] },
                  { name: "Asset classes", options: props.assetClasses },
                ],
                hideGroupLabel: true,
                show: (value) => (value === "" ? "All" : value),
                placement: "bottom end",
                buttonLabel:
                  props.assetClass === "" ? "Asset Class" : props.assetClass,
                selectedKey: props.assetClass,
                onSelectionChange: props.onAssetClassChange,
              })}
        />
        <SearchInput
          size="sm"
          width={50}
          placeholder="Feed symbol"
          {...(props.isLoading
            ? { isPending: true, isDisabled: true }
            : {
                value: props.search,
                onChange: props.onSearchChange,
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
    <Table
      rounded
      fill
      label="Price Feeds"
      stickyHeader={rootStyles.headerHeight}
      columns={[
        {
          id: "priceFeedName",
          name: "PRICE FEED",
          isRowHeader: true,
          alignment: "left",
          loadingSkeleton: <PriceFeedTag compact isLoading />,
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
          name: "PRICE",
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
