"use client";

import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { Badge } from "@pythnetwork/component-library/Badge";
import {
  type Props as CardProps,
  Card,
} from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { type ColumnConfig, Table } from "@pythnetwork/component-library/Table";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { createSerializer } from "nuqs";
import { type ReactNode, Suspense, use, useCallback, useMemo } from "react";
import { useFilter, useCollator } from "react-aria";

import styles from "./price-feeds-card.module.scss";
import { queryParams, useQuery } from "./use-query";
import { SKELETON_WIDTH, LivePrice, LiveConfidence } from "../LivePrices";

type Props = Omit<CardProps<"div">, "icon" | "title" | "toolbar" | "footer"> & {
  priceFeedsPromise: Promise<PriceFeed[]>;
  placeholderPriceFeedName: ReactNode;
};

type PriceFeed = {
  symbol: string;
  id: string;
  displaySymbol: string;
  assetClassAsString: string;
  exponent: number;
  numPublishers: number;
  weeklySchedule: string | undefined;
  priceFeedId: ReactNode;
  priceFeedName: ReactNode;
  assetClass: ReactNode;
};

export const PriceFeedsCard = ({
  priceFeedsPromise,
  className,
  placeholderPriceFeedName,
  ...props
}: Props) => (
  <Card
    className={clsx(className, styles.priceFeedsCard)}
    icon={<ChartLine />}
    title={
      <>
        <span>Price Feeds</span>
        <Suspense>
          <Badge style="filled" variant="neutral" size="md">
            <NumFeeds priceFeedsPromise={priceFeedsPromise} />
          </Badge>
        </Suspense>
      </>
    }
    toolbar={
      <div className={styles.toolbar ?? ""}>
        <Suspense
          fallback={
            <>
              <Select
                isPending
                options={[]}
                buttonLabel="Asset Class"
                {...assetClassSelectProps}
              />
              <SearchInput isPending isDisabled {...searchInputProps} />
            </>
          }
        >
          <ToolbarContents priceFeedsPromise={priceFeedsPromise} />
        </Suspense>
      </div>
    }
    footer={
      <Suspense>
        <Footer priceFeedsPromise={priceFeedsPromise} />
      </Suspense>
    }
    {...props}
  >
    <Suspense
      fallback={
        <Table isLoading {...sharedTableProps(placeholderPriceFeedName)} />
      }
    >
      <Results priceFeedsPromise={priceFeedsPromise} />
    </Suspense>
  </Card>
);

type NumFeedsProps = {
  priceFeedsPromise: Props["priceFeedsPromise"];
};

const NumFeeds = ({ priceFeedsPromise }: NumFeedsProps) =>
  useFilteredFeeds(priceFeedsPromise).length;

type ToolbarProps = {
  priceFeedsPromise: Props["priceFeedsPromise"];
};

const ToolbarContents = ({ priceFeedsPromise }: ToolbarProps) => {
  const { search, assetClass, updateSearch, updateAssetClass } = useQuery();
  const collator = useCollator();
  const priceFeeds = use(priceFeedsPromise);
  const assetClasses = useMemo(
    () =>
      [...new Set(priceFeeds.map((feed) => feed.assetClassAsString))].sort(
        (a, b) => collator.compare(a, b),
      ),
    [priceFeeds, collator],
  );

  return (
    <>
      <Select
        optionGroups={[
          { name: "All", options: [""] },
          { name: "Asset classes", options: assetClasses },
        ]}
        hideGroupLabel
        show={(value) => (value === "" ? "All" : value)}
        placement="bottom end"
        buttonLabel={assetClass === "" ? "Asset Class" : assetClass}
        selectedKey={assetClass}
        onSelectionChange={updateAssetClass}
        {...assetClassSelectProps}
      />
      <SearchInput
        defaultValue={search}
        onChange={updateSearch}
        {...searchInputProps}
      />
    </>
  );
};

const assetClassSelectProps = {
  label: "Asset Class",
  size: "sm" as const,
  variant: "outline" as const,
  hideLabel: true,
};

const searchInputProps = {
  size: "sm" as const,
  width: 40,
};

const Results = ({
  priceFeedsPromise,
}: {
  priceFeedsPromise: Props["priceFeedsPromise"];
}) => {
  const { page, pageSize } = useQuery();
  const filteredFeeds = useFilteredFeeds(priceFeedsPromise);
  const paginatedFeeds = useMemo(
    () => filteredFeeds.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, filteredFeeds],
  );
  const rows = useMemo(
    () =>
      paginatedFeeds.map(
        ({
          id,
          priceFeedName,
          assetClass,
          priceFeedId,
          exponent,
          numPublishers,
          weeklySchedule,
        }) => ({
          id,
          href: "/",
          data: {
            priceFeedName,
            assetClass,
            priceFeedId,
            price: <LivePrice account={id} />,
            confidenceInterval: <LiveConfidence account={id} />,
            exponent,
            numPublishers,
            weeklySchedule,
          },
        }),
      ),
    [paginatedFeeds],
  );

  return (
    <Table
      rows={rows}
      renderEmptyState={() => <p>No results!</p>}
      {...sharedTableProps()}
    />
  );
};

const sharedTableProps = (placeholderPriceFeedName?: ReactNode) => ({
  label: "Price Feeds",
  columns: [
    {
      id: "priceFeedName",
      name: "PRICE FEED",
      isRowHeader: true,
      alignment: "left",
      width: 50,
      loadingSkeleton: placeholderPriceFeedName,
    },
    {
      id: "assetClass",
      name: "ASSET CLASS",
      alignment: "left",
      width: 60,
    },
    {
      id: "priceFeedId",
      name: "PRICE FEED ID",
      alignment: "left",
      width: 40,
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
    {
      id: "weeklySchedule",
      name: "WEEKLY SCHEDULE",
      alignment: "left",
      width: 100,
    },
  ] as const satisfies ColumnConfig<string>[],
  rounded: true,
  fill: true,
});

const Footer = ({
  priceFeedsPromise,
}: {
  priceFeedsPromise: Props["priceFeedsPromise"];
}) => {
  const { page, pageSize, updatePage, updatePageSize } = useQuery();
  const filteredFeeds = useFilteredFeeds(priceFeedsPromise);

  const numPages = useMemo(
    () => Math.ceil(filteredFeeds.length / pageSize),
    [filteredFeeds, pageSize],
  );

  const pathname = usePathname();

  const mkPageLink = useCallback(
    (page: number) => {
      const serialize = createSerializer(queryParams);
      return `${pathname}${serialize({ page, pageSize })}`;
    },
    [pathname, pageSize],
  );

  return (
    <Paginator
      numPages={numPages}
      currentPage={page}
      onPageChange={updatePage}
      pageSize={pageSize}
      onPageSizeChange={updatePageSize}
      pageSizeOptions={[10, 20, 30, 40, 50]}
      mkPageLink={mkPageLink}
    />
  );
};

const useFilteredFeeds = (priceFeedsPromise: Promise<PriceFeed[]>) => {
  const { search, assetClass } = useQuery();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const collator = useCollator();
  const activeFeeds = use(priceFeedsPromise);
  const sortedFeeds = useMemo(
    () =>
      activeFeeds.sort((a, b) =>
        collator.compare(a.displaySymbol, b.displaySymbol),
      ),
    [activeFeeds, collator],
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

  return filteredFeeds;
};
