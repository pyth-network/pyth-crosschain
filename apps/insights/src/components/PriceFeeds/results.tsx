"use client";

import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { useLogger } from "@pythnetwork/app-logger";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { TableCard } from "@pythnetwork/component-library/TableCard";
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

import { columns } from "./columns";
import { PriceProvider } from "./prices";

type Props = {
  priceFeeds: {
    symbol: string;
    key: string;
    displaySymbol: string;
    data: ComponentProps<
      typeof TableCard<(typeof columns)[number]["id"]>
    >["rows"][number]["data"];
  }[];
};

const params = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  search: parseAsString.withDefault(""),
};

export const Results = ({ priceFeeds }: Props) => {
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
  const sortedRows = useMemo(
    () =>
      filteredFeeds.sort((a, b) =>
        collator.compare(a.displaySymbol, b.displaySymbol),
      ),
    [filteredFeeds, collator],
  );
  const paginatedRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sortedRows],
  );
  const rows = useMemo(
    () => paginatedRows.map(({ key, data }) => ({ id: key, href: "/", data })),
    [paginatedRows],
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
      return `${pathname}${serialize({ page, pageSize })}`;
    },
    [pathname, pageSize],
  );

  return (
    <PriceProvider feedKeys={feedKeys}>
      <TableCard
        label="Price Feeds"
        icon={ChartLine}
        columns={columns}
        isUpdating={isTransitioning}
        rows={rows}
        renderEmptyState={() => <p>No results!</p>}
        toolbar={
          <SearchInput
            defaultValue={search}
            onChange={updateSearch}
            size="sm"
            width={40}
          />
        }
        footer={
          <Paginator
            numPages={numPages}
            currentPage={page}
            onPageChange={updatePage}
            pageSize={pageSize}
            onPageSizeChange={updatePageSize}
            pageSizeOptions={[10, 20, 30, 40, 50]}
            mkPageLink={mkPageLink}
          />
        }
      />
    </PriceProvider>
  );
};
