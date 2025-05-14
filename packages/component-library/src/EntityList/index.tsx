"use client";

import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";
import { Skeleton } from "../Skeleton/index.jsx";
import { GridList, GridListItem } from "../unstyled/GridList";

type Props<T extends string> = ComponentProps<typeof GridList<RowConfig<T>>> & {
  headerLoadingSkeleton?: ReactNode | undefined;
  label: string;
  fields: ({
    id: T;
    name: ReactNode;
  } & (
    | { loadingSkeleton?: ReactNode | undefined }
    | { loadingSkeletonWidth?: number | undefined }
  ))[];
} & (
    | {
        isLoading: true;
        rows?: RowConfig<T>[] | undefined;
      }
    | {
        isLoading?: false | undefined;
        rows: RowConfig<T>[];
      }
  );

type RowConfig<T extends string> = {
  id: string | number;
  data: Record<T, ReactNode>;
  header?: ReactNode | undefined;
  href?: string;
  textValue: string;
};

export const EntityList = <T extends string>({
  fields,
  isLoading,
  rows,
  headerLoadingSkeleton,
  className,
  label,
  ...props
}: Props<T>) => (
  <GridList
    className={clsx(styles.entityList, className)}
    items={isLoading ? [] : rows}
    aria-label={label}
    {...props}
  >
    {isLoading ? (
      <GridListItem className={styles.entityItem ?? ""} textValue="Loading">
        <div className={styles.itemHeader}>{headerLoadingSkeleton}</div>
        <dl className={styles.itemDetails}>
          {fields.map((field) => (
            <div key={field.id} className={styles.itemDetailsItem}>
              <dt>{field.name}</dt>
              <dd>
                {"loadingSkeleton" in field ? (
                  field.loadingSkeleton
                ) : (
                  <Skeleton
                    width={
                      "loadingSkeletonWidth" in field
                        ? field.loadingSkeletonWidth
                        : 20
                    }
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </GridListItem>
    ) : (
      ({ data, header, ...props }) => (
        <GridListItem className={styles.entityItem ?? ""} {...props}>
          {header && <div className={styles.itemHeader}>{header}</div>}
          <dl className={styles.itemDetails}>
            {fields.map((field) => (
              <div key={field.id} className={styles.itemDetailsItem}>
                <dt>{field.name}</dt>
                <dd>{data[field.id]}</dd>
              </div>
            ))}
          </dl>
        </GridListItem>
      )
    )}
  </GridList>
);
