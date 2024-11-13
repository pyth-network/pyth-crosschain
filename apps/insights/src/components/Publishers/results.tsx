"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { Table } from "@pythnetwork/component-library/Table";
import { usePathname } from "next/navigation";
import { parseAsInteger, useQueryStates, createSerializer } from "nuqs";
import {
  type ComponentProps,
  useTransition,
  useMemo,
  useCallback,
} from "react";

import { Paginator } from "../Paginator";

type Props<T extends string> = Omit<
  ComponentProps<typeof Table<T>>,
  "isLoading" | "rows"
> & {
  publishers: {
    key: string;
    rank: number;
    data: ComponentProps<typeof Table<T>>["rows"][number]["data"];
  }[];
};

const params = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

export const Results = <T extends string>({
  publishers,
  ...props
}: Props<T>) => {
  const [isTransitioning, startTransition] = useTransition();
  const [{ page, pageSize }, setQuery] = useQueryStates(params);
  const rows = useMemo(
    () =>
      publishers
        .sort((a, b) => a.rank - b.rank)
        .slice((page - 1) * pageSize, page * pageSize)
        .map(({ key, data }) => ({ id: key, href: "/", data })),
    [page, pageSize, publishers],
  );
  const numPages = useMemo(
    () => Math.ceil(publishers.length / pageSize),
    [publishers, pageSize],
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

  const pathname = usePathname();

  const mkPageLink = useCallback(
    (page: number) => {
      const serialize = createSerializer(params);
      return `${pathname}${serialize({ page })}`;
    },
    [pathname],
  );

  return (
    <>
      <Table isLoading={isTransitioning} rows={rows} {...props} />
      <Paginator
        numPages={numPages}
        currentPage={page}
        setCurrentPage={updatePage}
        pageSize={pageSize}
        setPageSize={updatePageSize}
        mkPageLink={mkPageLink}
      />
    </>
  );
};
