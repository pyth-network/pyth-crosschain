"use client";

import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { type RowConfig, Table } from "@pythnetwork/component-library/Table";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useCallback, useMemo } from "react";
import { useFilter, useCollator } from "react-aria";

import { serialize, useQueryParams } from "./query-params";
import { SKELETON_WIDTH, LivePrice, LiveConfidence } from "../LivePrices";

type Props = {
  id: string;
  nameLoadingSkeleton: ReactNode;
  priceFeeds: PriceFeed[];
};

type PriceFeed = {
  symbol: string;
  id: string;
  displaySymbol: string;
  assetClassAsString: string;
  exponent: number;
  numPublishers: number;
  priceFeedId: ReactNode;
  priceFeedName: ReactNode;
  assetClass: ReactNode;
};

export const PriceFeedsCard = ({ priceFeeds, ...props }: Props) => (
  <Suspense fallback={<PriceFeedsCardContents isLoading {...props} />}>
    <ResolvedPriceFeedsCard priceFeeds={priceFeeds} {...props} />
  </Suspense>
);

const ResolvedPriceFeedsCard = ({ priceFeeds, ...props }: Props) => {
  const {
    search,
    page,
    pageSize,
    assetClass,
    updateSearch,
    updatePage,
    updatePageSize,
    updateAssetClass,
  } = useQueryParams();

  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const collator = useCollator();
  const sortedFeeds = useMemo(
    () =>
      priceFeeds.sort((a, b) =>
        collator.compare(a.displaySymbol, b.displaySymbol),
      ),
    [priceFeeds, collator],
  );
  const feedsFilteredByAssetClass = useMemo(
    () =>
      assetClass
        ? sortedFeeds.filter((feed) => feed.assetClassAsString === assetClass)
        : sortedFeeds,
    [assetClass, sortedFeeds],
  );
  const filteredFeeds = useMemo(() => {
    if (search === "") {
      return feedsFilteredByAssetClass;
    } else {
      const searchTokens = search
        .split(" ")
        .flatMap((item) => item.split(","))
        .filter(Boolean);
      return feedsFilteredByAssetClass.filter((feed) =>
        searchTokens.some((token) => filter.contains(feed.symbol, token)),
      );
    }
  }, [search, feedsFilteredByAssetClass, filter]);
  const paginatedFeeds = useMemo(
    () => filteredFeeds.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, filteredFeeds],
  );
  const rows = useMemo(
    () =>
      paginatedFeeds.map(({ id, ...data }) => ({
        id,
        href: "#",
        data: {
          ...data,
          price: <LivePrice account={id} />,
          confidenceInterval: <LiveConfidence account={id} />,
        },
      })),
    [paginatedFeeds],
  );

  const numPages = useMemo(
    () => Math.ceil(filteredFeeds.length / pageSize),
    [filteredFeeds.length, pageSize],
  );

  const pathname = usePathname();

  const mkPageLink = useCallback(
    (page: number) => `${pathname}${serialize({ page, pageSize })}`,
    [pathname, pageSize],
  );

  const assetClasses = useMemo(
    () =>
      [...new Set(priceFeeds.map((feed) => feed.assetClassAsString))].sort(
        (a, b) => collator.compare(a, b),
      ),
    [priceFeeds, collator],
  );

  return (
    <PriceFeedsCardContents
      numResults={filteredFeeds.length}
      search={search}
      assetClass={assetClass}
      assetClasses={assetClasses}
      numPages={numPages}
      page={page}
      pageSize={pageSize}
      onSearchChange={updateSearch}
      onAssetClassChange={updateAssetClass}
      onPageSizeChange={updatePageSize}
      onPageChange={updatePage}
      mkPageLink={mkPageLink}
      rows={rows}
      {...props}
    />
  );
};

type PriceFeedsCardContents = Pick<Props, "id" | "nameLoadingSkeleton"> &
  (
    | { isLoading: true }
    | {
        isLoading?: false;
        numResults: number;
        search: string;
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

const PriceFeedsCardContents = ({
  id,
  nameLoadingSkeleton,
  ...props
}: PriceFeedsCardContents) => (
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
          width={40}
          {...(props.isLoading
            ? { isPending: true, isDisabled: true }
            : {
                defaultValue: props.search,
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
      columns={[
        {
          id: "priceFeedName",
          name: "PRICE FEED",
          isRowHeader: true,
          alignment: "left",
          width: 50,
          loadingSkeleton: nameLoadingSkeleton,
        },
        {
          id: "assetClass",
          name: "ASSET CLASS",
          alignment: "left",
          width: 60,
          loadingSkeletonWidth: 20,
        },
        {
          id: "priceFeedId",
          name: "PRICE FEED ID",
          alignment: "left",
          width: 40,
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
          width: 40,
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
            renderEmptyState: () => <p>No results!</p>,
          })}
    />
  </Card>
);
