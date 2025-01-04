"use client";

import { type RowConfig, Table } from "@pythnetwork/component-library/Table";
import { type ReactNode, useMemo } from "react";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";

type Props = {
  publisherScoreWidth: number;
  rows: RowConfig<"score" | "asset" | "assetClass">[];
  emptyState: ReactNode;
  label: string;
};

export const TopFeedsTable = ({
  publisherScoreWidth,
  rows,
  ...props
}: Props) => {
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
    <Table
      rounded
      fill
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
      hideHeadersInEmptyState
      rows={rowsWithAction}
      {...props}
    />
  );
};
