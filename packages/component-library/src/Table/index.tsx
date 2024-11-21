"use client";

import { useDebouncedEffect } from "@react-hookz/web";
import clsx from "clsx";
import { type ReactNode, useState } from "react";
import type {
  RowProps,
  ColumnProps,
  TableBodyProps,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Skeleton } from "../Skeleton/index.js";
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
  isUpdating?: boolean | undefined;
  renderEmptyState?: TableBodyProps<T>["renderEmptyState"];
};

export type ColumnConfig<T extends string> = Omit<ColumnProps, "children"> & {
  name: ReactNode;
  id: T;
  fill?: boolean | undefined;
  alignment?: Alignment | undefined;
  loadingSkeletonWidth?: number | undefined;
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
  isUpdating,
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
    <div className={styles.tableContainer}>
      {isUpdating && (
        <div className={styles.loaderWrapper}>
          <div className={styles.loader} />
        </div>
      )}
      <UnstyledTable aria-label={label} className={styles.table ?? ""}>
        <UnstyledTableHeader
          columns={columns}
          className={styles.tableHeader ?? ""}
        >
          {({ fill, alignment, ...column }: ColumnConfig<T>) => (
            <UnstyledColumn {...cellProps(alignment, fill)} {...column}>
              {column.name}
            </UnstyledColumn>
          )}
        </UnstyledTableHeader>
        <UnstyledTableBody
          items={isLoading ? [] : debouncedRows}
          className={styles.tableBody ?? ""}
          {...(renderEmptyState !== undefined && { renderEmptyState })}
        >
          {isLoading ? (
            <UnstyledRow
              id="loading"
              key="loading"
              className={styles.row ?? ""}
              columns={columns}
            >
              {({ alignment, fill, loadingSkeletonWidth }: ColumnConfig<T>) => (
                <UnstyledCell {...cellProps(alignment, fill)}>
                  <Skeleton width={loadingSkeletonWidth ?? 10} />
                </UnstyledCell>
              )}
            </UnstyledRow>
          ) : (
            ({ className: rowClassName, data, ...row }: RowConfig<T>) => (
              <UnstyledRow
                className={clsx(styles.row, rowClassName)}
                columns={columns}
                {...row}
              >
                {({ alignment, fill, id }: ColumnConfig<T>) => (
                  <UnstyledCell {...cellProps(alignment, fill)}>
                    {data[id]}
                  </UnstyledCell>
                )}
              </UnstyledRow>
            )
          )}
        </UnstyledTableBody>
      </UnstyledTable>
    </div>
  );
};

const cellProps = (
  alignment: Alignment | undefined,
  fill: boolean | undefined,
) => ({
  className: styles.cell ?? "",
  "data-alignment": alignment ?? "left",
  ...(fill && { "data-fill": "" }),
});
