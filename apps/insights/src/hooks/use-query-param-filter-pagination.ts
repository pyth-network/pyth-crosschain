"use client";

import type { SortDescriptor } from "@pythnetwork/component-library/unstyled/Table";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { usePathname } from "next/navigation";
import {
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
  useQueryStates,
  createSerializer,
} from "nuqs";
import { useCallback, useMemo } from "react";

export const useQueryParamFilterPagination = <T>(
  items: T[],
  predicate: (item: T, term: string) => boolean,
  doSort: (a: T, b: T, descriptor: SortDescriptor) => number,
  options?: {
    defaultPageSize?: number | undefined;
    defaultSort?: string | undefined;
    defaultDescending?: boolean;
  },
) => {
  const logger = useLogger();

  const queryParams = useMemo(
    () => ({
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(options?.defaultPageSize ?? 30),
      search: parseAsString.withDefault(""),
      sort: parseAsString.withDefault(options?.defaultSort ?? ""),
      descending: parseAsBoolean.withDefault(
        options?.defaultDescending ?? false,
      ),
    }),
    [options],
  );

  const [{ search, page, pageSize, sort, descending }, setQuery] =
    useQueryStates(queryParams);

  const sortDescriptor = useMemo(
    (): SortDescriptor => ({
      column: sort,
      direction: descending ? "descending" : "ascending",
    }),
    [sort, descending],
  );

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

  const updateSortDescriptor = useCallback(
    ({ column, direction }: SortDescriptor) => {
      updateQuery({
        page: 1,
        sort: column.toString(),
        descending: direction === "descending",
      });
    },
    [updateQuery],
  );

  const filteredItems = useMemo(
    () =>
      search === "" ? items : items.filter((item) => predicate(item, search)),
    [items, search, predicate],
  );

  const sortedItems = useMemo(
    () => filteredItems.toSorted((a, b) => doSort(a, b, sortDescriptor)),
    [filteredItems, sortDescriptor, doSort],
  );

  const paginatedItems = useMemo(
    () => sortedItems.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sortedItems],
  );

  const numPages = useMemo(
    () => Math.ceil(filteredItems.length / pageSize),
    [filteredItems.length, pageSize],
  );

  const pathname = usePathname();

  const mkPageLink = useCallback(
    (page: number) => {
      const serialize = createSerializer(queryParams);
      return `${pathname}${serialize({ page, pageSize })}`;
    },
    [pathname, pageSize, queryParams],
  );

  return {
    search,
    sortDescriptor,
    page,
    pageSize,
    updateSearch,
    updateSortDescriptor,
    updatePage,
    updatePageSize,
    paginatedItems,
    numPages,
    mkPageLink,
    numResults: filteredItems.length,
  };
};
