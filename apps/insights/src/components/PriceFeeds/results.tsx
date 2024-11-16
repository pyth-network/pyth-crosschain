"use client";

import {
  MagnifyingGlass,
  ChartLine,
  CircleNotch,
} from "@phosphor-icons/react/dist/ssr";
import { useLogger } from "@pythnetwork/app-logger";
import { Card } from "@pythnetwork/component-library/Card";
import { Table } from "@pythnetwork/component-library/Table";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
  createSerializer,
} from "nuqs";
import {
  type ComponentProps,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import { useFilter, useCollator } from "react-aria";
import { Input, SearchField } from "react-aria-components";

import { PriceProvider } from "./prices";
import { Paginator } from "../Paginator";

type Props<T extends string> = Omit<
  ComponentProps<typeof Table<T>>,
  "isLoading" | "rows"
> & {
  priceFeeds: {
    symbol: string;
    key: string;
    displaySymbol: string;
    data: ComponentProps<typeof Table<T>>["rows"][number]["data"];
  }[];
};

const params = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  search: parseAsString.withDefault(""),
};

export const Results = <T extends string>({
  priceFeeds,
  ...props
}: Props<T>) => {
  const [isTransitioning, startTransition] = useTransition();
  const [{ page, pageSize, search }, setQuery] = useQueryStates(params);
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const collator = useCollator();
  const filteredFeeds = useMemo(
    () =>
      search === ""
        ? priceFeeds
        : priceFeeds.filter((feed) => filter.contains(feed.symbol, search)),
    [search, priceFeeds, filter],
  );
  const rows = useMemo(
    () =>
      filteredFeeds
        .sort((a, b) => collator.compare(a.displaySymbol, b.displaySymbol))
        .slice((page - 1) * pageSize, page * pageSize)
        .map(({ key, data }) => ({ id: key, href: "/", data })),
    [page, pageSize, filteredFeeds, collator],
  );
  const numPages = useMemo(
    () => Math.ceil(filteredFeeds.length / pageSize),
    [filteredFeeds, pageSize],
  );

  const logger = useLogger();

  const updateQuery = useCallback(
    (...params: Parameters<typeof setQuery>) => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      startTransition(() => {
        setQuery(...params).catch((error: unknown) => {
          logger.error("Failed to update query", error);
        });
      });
    },
    [setQuery, startTransition, logger],
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

  const updateSearch = useCallback(
    (newSearch: string) => {
      updateQuery({ page: 1, search: newSearch });
    },
    [updateQuery],
  );

  const feedKeys = useMemo(() => rows.map((row) => row.id), [rows]);

  const pathname = usePathname();

  const mkPageLink = useCallback(
    (page: number) => {
      const serialize = createSerializer(params);
      return `${pathname}${serialize({ page })}`;
    },
    [pathname],
  );

  return (
    <Card
      header={
        <div className="flex flex-row items-center gap-3">
          <ChartLine className="size-6 text-violet-600" />
          <div>Price Feeds</div>
        </div>
      }
      toolbarLabel="Price Feeds"
      toolbar={<SearchBar search={search} setSearch={updateSearch} />}
      full
    >
      <PriceProvider feedKeys={feedKeys}>
        <Table
          isLoading={isTransitioning}
          rows={rows}
          renderEmptyState={() => <p>No results!</p>}
          {...props}
        />
      </PriceProvider>
      <Paginator
        numPages={numPages}
        currentPage={page}
        setCurrentPage={updatePage}
        pageSize={pageSize}
        setPageSize={updatePageSize}
        mkPageLink={mkPageLink}
      />
    </Card>
  );
};

type SearchBarProps = {
  search: string;
  setSearch: (newSearch: string) => void;
};

const SearchBar = ({ search, setSearch }: SearchBarProps) => {
  const [isTransitioning, startTransition] = useTransition();
  const Icon = isTransitioning ? CircleNotch : MagnifyingGlass;

  const doSearch = useCallback(
    (search: string) => {
      startTransition(() => {
        setSearch(search);
      });
    },
    [setSearch, startTransition],
  );

  return (
    <div className="space-x-2">
      <SearchField
        defaultValue={search}
        onChange={doSearch}
        aria-label="Search"
        className="inline-block"
      >
        <span className="relative inline-block h-9 w-48">
          <Input
            className="inline-block size-full rounded-lg border border-stone-300 bg-white px-button-padding-sm pl-9 text-sm ring-violet-500 placeholder:text-stone-400 data-[focused]:ring-2 data-[focused]:ring-violet-500 focus:border-stone-300 focus:outline-0 dark:bg-steel-900 dark:placeholder:text-steel-400"
            placeholder="Search"
          />
          <Icon
            className={clsx(
              "pointer-events-none absolute inset-y-2 left-button-padding-sm size-5",
              { "animate-spin": isTransitioning },
            )}
          />
        </span>
      </SearchField>
    </div>
  );
};
