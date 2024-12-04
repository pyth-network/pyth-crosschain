"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { parseAsString, parseAsInteger, useQueryStates } from "nuqs";
import {
  type ReactNode,
  type ComponentProps,
  Suspense,
  createContext,
  useCallback,
  useMemo,
  use,
} from "react";
import { useFilter, useCollator } from "react-aria";

export const queryParams = {
  assetClass: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(30),
  search: parseAsString.withDefault(""),
};

const FilteredPriceFeedsContext = createContext<
  undefined | ReturnType<typeof useFilteredPriceFeedsContext>
>(undefined);

type FilteredPriceFeedsProviderProps = Omit<
  ComponentProps<typeof FilteredPriceFeedsContext>,
  "value"
> & {
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

export const FilteredPriceFeedsProvider = (
  props: FilteredPriceFeedsProviderProps,
) => (
  <Suspense>
    <ResolvedFilteredPriceFeedsProvider {...props} />
  </Suspense>
);

const ResolvedFilteredPriceFeedsProvider = ({
  priceFeeds,
  ...props
}: FilteredPriceFeedsProviderProps) => {
  const value = useFilteredPriceFeedsContext(priceFeeds);

  return <FilteredPriceFeedsContext value={value} {...props} />;
};

export const useFilteredPriceFeedsContext = (priceFeeds: PriceFeed[]) => {
  const logger = useLogger();

  const [{ search, page, pageSize, assetClass }, setQuery] =
    useQueryStates(queryParams);

  const updateQuery = useCallback(
    (...params: Parameters<typeof setQuery>) => {
      setQuery(...params).catch((error: unknown) => {
        logger.error("Failed to update query", error);
      });
    },
    [setQuery, logger],
  );

  const updateSearch = useCallback(
    (newSearch: string) => {
      updateQuery({ page: 1, search: newSearch });
    },
    [updateQuery],
  );

  const updatePage = useCallback(
    (newPage: number) => {
      updateQuery({ page: newPage });
    },
    [updateQuery],
  );

  const updatePageSize = useCallback(
    (newPageSize: number) => {
      updateQuery({ page: 1, pageSize: newPageSize });
    },
    [updateQuery],
  );

  const updateAssetClass = useCallback(
    (newAssetClass: string) => {
      updateQuery({ page: 1, assetClass: newAssetClass });
    },
    [updateQuery],
  );

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

  return {
    filteredFeeds,
    paginatedFeeds,
    search,
    page,
    pageSize,
    assetClass,
    updateSearch,
    updatePage,
    updatePageSize,
    updateAssetClass,
  };
};

export const useFilteredPriceFeeds = () => {
  const value = use(FilteredPriceFeedsContext);
  if (value) {
    return value;
  } else {
    throw new FilteredPriceFeedsNotInitializedError();
  }
};

class FilteredPriceFeedsNotInitializedError extends Error {
  constructor() {
    super("This component must be a child of <FilteredPriceFeedsProvider>");
    this.name = "FilteredPriceFeedsNotInitializedError";
  }
}
