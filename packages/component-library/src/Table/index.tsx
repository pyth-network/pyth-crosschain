"use client";

import { useDebouncedEffect } from "@react-hookz/web";
import clsx from "clsx";
import { type ReactNode, useState } from "react";
import type {
  RowProps,
  ColumnProps,
  TableBodyProps,
} from "react-aria-components";

import {
  UnstyledCell,
  UnstyledColumn,
  UnstyledRow,
  UnstyledTable,
  UnstyledTableBody,
  UnstyledTableHeader,
} from "../UnstyledTable/index.js";

type TableProps<T extends string> = {
  label: string;
  columns: ColumnConfig<T>[];
  rows: RowConfig<T>[];
  isLoading?: boolean | undefined;
  renderEmptyState?: TableBodyProps<T>["renderEmptyState"];
};

type ColumnConfig<T extends string> = Omit<ColumnProps, "children"> & {
  name: ReactNode;
  id: T;
  fill?: boolean | undefined;
  alignment?: Alignment;
};

type Alignment = "left" | "center" | "right" | undefined;

type RowConfig<T extends string> = Omit<
  RowProps<T>,
  "columns" | "children" | "value"
> & {
  id: string | number;
  data: Record<T, ReactNode>;
};

export const Table = <T extends string>({
  label,
  rows,
  columns,
  isLoading,
  renderEmptyState,
}: TableProps<T>) => {
  const [debouncedRows, setDebouncedRows] = useState(rows);

  useDebouncedEffect(
    () => {
      setDebouncedRows(rows);
    },
    [rows],
    500,
  );

  return (
    <div className="relative">
      {isLoading && (
        <div
          className={clsx(
            "absolute left-0 right-0 top-8 z-10 h-0.5 overflow-hidden opacity-0 transition",
            {
              "opacity-100": true,
            },
          )}
        >
          <div className="size-full origin-left animate-progress bg-violet-500" />
        </div>
      )}
      <UnstyledTable aria-label={label}>
        <UnstyledTableHeader
          columns={columns}
          className="border-b border-stone-300 bg-beige-100 pb-4 text-xs text-stone-600 dark:border-steel-600 dark:bg-steel-900 dark:text-steel-400"
        >
          {(column: ColumnConfig<T>) => (
            <UnstyledColumn
              className={clsx(
                "whitespace-nowrap pb-4 font-medium",
                cellClassName(columns, column),
              )}
              {...column}
            >
              {column.name}
            </UnstyledColumn>
          )}
        </UnstyledTableHeader>
        <UnstyledTableBody
          items={debouncedRows}
          className="text-sm"
          {...(renderEmptyState !== undefined && { renderEmptyState })}
        >
          {({ className: rowClassName, data, ...row }: RowConfig<T>) => (
            <UnstyledRow
              className={clsx(
                "h-16 transition-colors duration-100 data-[hovered]:bg-black/5 data-[pressed]:bg-black/10 dark:data-[hovered]:bg-white/5 dark:data-[pressed]:bg-white/10",
                { "cursor-pointer": "href" in row },
                rowClassName,
              )}
              columns={columns}
              {...row}
            >
              {(column: ColumnConfig<T>) => (
                <UnstyledCell className={cellClassName(columns, column)}>
                  {data[column.id]}
                </UnstyledCell>
              )}
            </UnstyledRow>
          )}
        </UnstyledTableBody>
      </UnstyledTable>
    </div>
  );
};

const cellClassName = <T extends string>(
  columns: ColumnConfig<T>[],
  column: ColumnConfig<T>,
) =>
  clsx("px-2", {
    "pl-4": column === columns[0],
    "pr-4": column === columns.at(-1),
    "text-left": column.alignment === "left",
    "text-right": column.alignment === "right",
    "text-center":
      column.alignment === "center" || column.alignment === undefined,
    "w-full": column.fill,
  });
