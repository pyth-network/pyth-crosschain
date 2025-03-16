"use client";

import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useMemo } from "react";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";
import styles from "./top-feeds-table.module.scss";
import { EntityList } from "../EntityList";

type Props = {
  publisherScoreWidth: number;
  rows: (RowConfig<"score" | "asset" | "assetClass"> & { textValue: string })[];
  label: string;
};

export const TopFeedsTable = ({ publisherScoreWidth, rows, label }: Props) => {
  const selectPriceFeed = useSelectPriceFeed();

  const rowsWithAction = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        ...(selectPriceFeed && {
          onAction: () => {
            selectPriceFeed(row.id.toString());
          },
        }),
      })),
    [selectPriceFeed, rows],
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
        rows={rowsWithAction.map((row) => ({
          ...row,
          textValue: row.textValue,
          header: row.data.asset,
        }))}
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
        rows={rowsWithAction}
      />
    </>
  );
};
