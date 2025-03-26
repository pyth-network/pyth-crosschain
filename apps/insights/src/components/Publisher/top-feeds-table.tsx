"use client";

import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useMemo } from "react";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";
import styles from "./top-feeds-table.module.scss";
import { EntityList } from "../EntityList";

type Props = {
  publisherScoreWidth: number;
  label: string;
} & (
  | { isLoading: true; rows?: undefined }
  | {
      isLoading?: false | undefined;
      rows: (RowConfig<"score" | "asset" | "assetClass"> & {
        textValue: string;
      })[];
    }
);

export const TopFeedsTable = ({
  publisherScoreWidth,
  label,
  ...props
}: Props) => {
  const selectPriceFeed = useSelectPriceFeed();

  const rowsWithAction = useMemo(
    () =>
      props.isLoading
        ? undefined
        : props.rows.map((row) => ({
            ...row,
            ...(selectPriceFeed && {
              onAction: () => {
                selectPriceFeed(row.id.toString());
              },
            }),
          })),
    [selectPriceFeed, props.isLoading, props.rows],
  );

  return (
    <>
      <EntityList
        label={label}
        className={styles.list ?? ""}
        fields={[
          { id: "score", name: "Score" },
          { id: "assetClass", name: "Asset Class" },
        ]}
        {...(rowsWithAction === undefined
          ? { isLoading: true }
          : {
              rows: rowsWithAction.map((row) => ({
                ...row,
                textValue: row.textValue,
                header: row.data.asset,
              })),
            })}
      />
      <Table
        label={label}
        rounded
        fill
        className={styles.table ?? ""}
        columns={[
          {
            id: "score",
            name: "SCORE",
            alignment: "left",
            width: publisherScoreWidth,
          },
          {
            id: "asset",
            name: "ASSET",
            isRowHeader: true,
            alignment: "left",
          },
          {
            id: "assetClass",
            name: "ASSET CLASS",
            alignment: "right",
            width: 40,
          },
        ]}
        {...(rowsWithAction === undefined
          ? { isLoading: true }
          : {
              rows: rowsWithAction,
            })}
      />
    </>
  );
};
