"use client";

import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
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
  className?: string | undefined;
  fill?: boolean | undefined;
  divide?: boolean | undefined;
  rounded?: boolean | undefined;
  label: string;
  columns: ColumnConfig<T>[];
  isLoading?: boolean | undefined;
  isUpdating?: boolean | undefined;
  renderEmptyState?: TableBodyProps<T>["renderEmptyState"] | undefined;
  dependencies?: TableBodyProps<T>["dependencies"] | undefined;
} & (
  | { isLoading: true; rows?: RowConfig<T>[] | undefined }
  | { isLoading?: false | undefined; rows: RowConfig<T>[] }
);

export type ColumnConfig<T extends string> = Omit<ColumnProps, "children"> & {
  name: ReactNode;
  id: T;
  fill?: boolean | undefined;
  sticky?: boolean | undefined;
  alignment?: Alignment | undefined;
  width?: number | undefined;
} & (
    | { loadingSkeleton?: ReactNode }
    | { loadingSkeletonWidth?: number | undefined }
  );

type Alignment = "left" | "center" | "right" | undefined;

export type RowConfig<T extends string> = Omit<
  RowProps<T>,
  "columns" | "children" | "value"
> & {
  id: string | number;
  data: Record<T, ReactNode>;
};

export const Table = <T extends string>({
  className,
  fill,
  divide,
  rounded,
  label,
  rows,
  columns,
  isLoading,
  isUpdating,
  renderEmptyState,
  dependencies,
}: TableProps<T>) => (
  <div
    className={clsx(styles.tableContainer, className)}
    data-fill={fill ? "" : undefined}
    data-divide={divide ? "" : undefined}
    data-rounded={rounded ? "" : undefined}
  >
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
        {(column: ColumnConfig<T>) => (
          <UnstyledColumn {...cellProps(column)} {...column}>
            {column.name}
          </UnstyledColumn>
        )}
      </UnstyledTableHeader>
      <UnstyledTableBody
        items={isLoading ? [] : rows}
        className={styles.tableBody ?? ""}
        {...(dependencies !== undefined && { dependencies })}
        {...(renderEmptyState !== undefined && { renderEmptyState })}
      >
        {isLoading ? (
          <UnstyledRow
            id="loading"
            key="loading"
            className={styles.row ?? ""}
            columns={columns}
          >
            {(column: ColumnConfig<T>) => (
              <UnstyledCell {...cellProps(column)}>
                {"loadingSkeleton" in column ? (
                  column.loadingSkeleton
                ) : (
                  <Skeleton
                    width={
                      "loadingSkeletonWidth" in column
                        ? column.loadingSkeletonWidth
                        : column.width
                    }
                  />
                )}
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
              {(column: ColumnConfig<T>) => (
                <UnstyledCell {...cellProps(column)}>
                  {data[column.id]}
                </UnstyledCell>
              )}
            </UnstyledRow>
          )
        )}
      </UnstyledTableBody>
    </UnstyledTable>
  </div>
);

const cellProps = <T extends string>({
  alignment,
  width,
  fill,
  sticky,
}: Pick<ColumnConfig<T>, "alignment" | "width" | "fill" | "sticky">) => ({
  className: styles.cell ?? "",
  "data-alignment": alignment ?? "left",
  "data-fill": fill ? "" : undefined,
  "data-sticky": sticky ? "" : undefined,
  ...(width && { style: { "--width": width } as CSSProperties }),
});
