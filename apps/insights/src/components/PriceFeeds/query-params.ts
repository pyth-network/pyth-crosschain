import { useLogger } from "@pythnetwork/app-logger";
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
  createSerializer,
} from "nuqs";
import { useCallback } from "react";

const queryParams = {
  assetClass: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(30),
  search: parseAsString.withDefault(""),
};

export const serialize = createSerializer(queryParams);

export const useQueryParams = () => {
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

  return {
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
