"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { usePathname } from "next/navigation";
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
  createSerializer,
} from "nuqs";
import { useCallback, useMemo } from "react";

export const useQueryParamFilterPagination = <T>(
  items: T[],
  predicate: (item: T, term: string) => boolean,
  options?: { defaultPageSize: number },
) => {
  const logger = useLogger();

  const queryParams = useMemo(
    () => ({
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(options?.defaultPageSize ?? 30),
      search: parseAsString.withDefault(""),
    }),
    [options],
  );

  const [{ search, page, pageSize }, setQuery] = useQueryStates(queryParams);

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

  const filteredItems = useMemo(
    () =>
      search === "" ? items : items.filter((item) => predicate(item, search)),
    [items, search, predicate],
  );
  const paginatedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, filteredItems],
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
    page,
    pageSize,
    updateSearch,
    updatePage,
    updatePageSize,
    paginatedItems,
    numPages,
    mkPageLink,
    numResults: filteredItems.length,
  };
};
