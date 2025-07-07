"use client";

import clsx from "clsx";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type {
  RowProps,
  ColumnProps,
  TableBodyProps,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.jsx";
import { Skeleton } from "../Skeleton/index.jsx";
import {
  Cell,
  Column,
  Row,
  Table as UnstyledTable,
  TableBody,
  TableHeader,
} from "../unstyled/Table/index.jsx";

export type { SortDescriptor } from "../unstyled/Table/index.jsx";

type TableProps<T extends string> = ComponentProps<typeof UnstyledTable> & {
  className?: string | undefined;
  headerCellClassName?: string | undefined;
  stickyHeader?: "top" | "appHeader" | undefined;
  fill?: boolean | undefined;
  rounded?: boolean | undefined;
  label: string;
  columns: ColumnConfig<T>[];
  isLoading?: boolean | undefined;
  isUpdating?: boolean | undefined;
  dependencies?: TableBodyProps<T>["dependencies"] | undefined;
} & (
    | { isLoading: true; rows?: RowConfig<T>[] | undefined }
    | { isLoading?: false | undefined; rows: RowConfig<T>[] }
  ) &
  (
    | { hideHeadersInEmptyState?: undefined }
    | ({ hideHeadersInEmptyState?: boolean } & (
        | { emptyState: ReactNode }
        | {
            renderEmptyState: NonNullable<
              TableBodyProps<T>["renderEmptyState"]
            >;
          }
      ))
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
  rounded,
  label,
  rows,
  columns,
  isLoading,
  isUpdating,
  dependencies,
  headerCellClassName,
  stickyHeader,
  ...props
}: TableProps<T>) => (
  <div
    className={clsx(styles.tableContainer, className)}
    data-fill={fill ? "" : undefined}
    data-rounded={rounded ? "" : undefined}
  >
    {isUpdating && (
      <div className={styles.loaderWrapper}>
        <div className={styles.loader} />
      </div>
    )}
    {props.hideHeadersInEmptyState === true && rows?.length === 0 ? (
      <>
        {"renderEmptyState" in props
          ? props.renderEmptyState({ isEmpty: true, isDropTarget: false })
          : props.emptyState}
      </>
    ) : (
      <UnstyledTable
        aria-label={label}
        className={styles.table ?? ""}
        {...props}
      >
        <TableHeader columns={columns} className={styles.tableHeader ?? ""}>
          {(columnConfig: ColumnConfig<T>) => (
            <Column
              data-sticky-header={stickyHeader}
              {...columnConfig}
              {...cellProps(columnConfig, headerCellClassName)}
            >
              {({ allowsSorting, sortDirection, ...column }) => (
                <>
                  <div className={styles.name}>{columnConfig.name}</div>
                  {allowsSorting && (
                    <Button
                      className={styles.sortButton ?? ""}
                      size="xs"
                      variant="ghost"
                      onPress={() => {
                        column.sort(
                          sortDirection === "ascending"
                            ? "descending"
                            : "ascending",
                        );
                      }}
                      beforeIcon={
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path
                            className={styles.ascending}
                            d="m10.677 6.073-2.5-2.5a.25.25 0 0 0-.354 0l-2.5 2.5A.25.25 0 0 0 5.5 6.5h5a.25.25 0 0 0 .177-.427Z"
                          />
                          <path
                            className={styles.descending}
                            d="m10.677 9.927-2.5 2.5a.25.25 0 0 1-.354 0l-2.5-2.5A.25.25 0 0 1 5.5 9.5h5a.25.25 0 0 1 .177.427Z"
                          />
                        </svg>
                      }
                      hideText
                    >
                      Sort
                    </Button>
                  )}
                  <div className={styles.divider} />
                </>
              )}
            </Column>
          )}
        </TableHeader>
        <TableBody
          items={isLoading ? [] : rows}
          className={styles.tableBody ?? ""}
          {...(dependencies !== undefined && { dependencies })}
          {...(!props.hideHeadersInEmptyState &&
            ("renderEmptyState" in props || "emptyState" in props) && {
              renderEmptyState:
                "renderEmptyState" in props
                  ? props.renderEmptyState
                  : () => props.emptyState,
            })}
        >
          {isLoading ? (
            <Row
              id="loading"
              key="loading"
              className={styles.row ?? ""}
              columns={columns}
            >
              {(column: ColumnConfig<T>) => (
                <Cell {...cellProps(column)}>
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
                </Cell>
              )}
            </Row>
          ) : (
            ({ className: rowClassName, data, ...row }: RowConfig<T>) => (
              <Row
                className={clsx(styles.row, rowClassName)}
                columns={columns}
                data-has-action={row.onAction === undefined ? undefined : ""}
                {...row}
              >
                {(column: ColumnConfig<T>) => (
                  <Cell {...cellProps(column)}>{data[column.id]}</Cell>
                )}
              </Row>
            )
          )}
        </TableBody>
      </UnstyledTable>
    )}
  </div>
);

const cellProps = <T extends string>(
  {
    className,
    alignment,
    width,
    fill,
    sticky,
  }: Pick<
    ColumnConfig<T>,
    "alignment" | "width" | "fill" | "sticky" | "className"
  >,
  extraClassName?: string,
  extraStyle?: CSSProperties,
) => ({
  className: clsx(styles.cell, extraClassName, className),
  "data-alignment": alignment ?? "left",
  "data-fill": fill ? "" : undefined,
  "data-sticky": sticky ? "" : undefined,
  style: {
    ...extraStyle,
    ...(width && ({ "--width": width } as CSSProperties)),
  },
});
