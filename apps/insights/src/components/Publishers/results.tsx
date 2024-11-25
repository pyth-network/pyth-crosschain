"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { TableCard } from "@pythnetwork/component-library/TableCard";
import { usePathname } from "next/navigation";
import { parseAsInteger, useQueryStates, createSerializer } from "nuqs";
import {
  type ComponentProps,
  useTransition,
  useMemo,
  useCallback,
} from "react";

import { columns } from "./columns";

type Props = {
  publishers: {
    key: string;
    rank: number;
    data: ComponentProps<
      typeof TableCard<(typeof columns)[number]["id"]>
    >["rows"][number]["data"];
  }[];
};

const params = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

export const Results = ({ publishers }: Props) => {
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
      return `${pathname}${serialize({ page, pageSize })}`;
    },
    [pathname, pageSize],
  );

  return (
    <TableCard
      label="Publishers"
      columns={columns}
      isUpdating={isTransitioning}
      rows={rows}
      footer={
        <Paginator
          numPages={numPages}
          currentPage={page}
          onPageChange={updatePage}
          pageSize={pageSize}
          onPageSizeChange={updatePageSize}
          mkPageLink={mkPageLink}
          pageSizeOptions={[10, 20, 30, 40, 50]}
        />
      }
    />
  );
};
