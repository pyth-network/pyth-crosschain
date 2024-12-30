"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import { Table } from "@pythnetwork/component-library/Table";
import { useMemo } from "react";
import { useCollator } from "react-aria";

import styles from "./reference-data.module.scss";
import { LiveValue } from "../LivePrices";

type Props = {
  feed: {
    symbol: string;
    feedKey: string;
    assetClass: string;
    base?: string | undefined;
    description: string;
    country?: string | undefined;
    quoteCurrency?: string | undefined;
    tenor?: string | undefined;
    cmsSymbol?: string | undefined;
    cqsSymbol?: string | undefined;
    nasdaqSymbol?: string | undefined;
    genericSymbol?: string | undefined;
    weeklySchedule?: string | undefined;
    schedule?: string | undefined;
    contractId?: string | undefined;
    displaySymbol: string;
    exponent: number;
    numComponentPrices: number;
    numQuoters: number;
    minPublishers: number;
    lastSlot: bigint;
    validSlot: bigint;
  };
};

export const ReferenceData = ({ feed }: Props) => {
  const collator = useCollator();

  const rows = useMemo(
    () =>
      [
        ...Object.entries({
          "Asset Type": (
            <Badge variant="neutral" style="outline" size="xs">
              {feed.assetClass.toUpperCase()}
            </Badge>
          ),
          Base: feed.base,
          Description: feed.description,
          Symbol: feed.symbol,
          Country: feed.country,
          "Quote Currency": feed.quoteCurrency,
          Tenor: feed.tenor,
          "CMS Symbol": feed.cmsSymbol,
          "CQS Symbol": feed.cqsSymbol,
          "NASDAQ Symbol": feed.nasdaqSymbol,
          "Generic Symbol": feed.genericSymbol,
          "Weekly Schedule": feed.weeklySchedule,
          Schedule: feed.schedule,
          "Contract ID": feed.contractId,
          "Display Symbol": feed.displaySymbol,
        }),
        ...Object.entries({
          Exponent: "exponent",
          "Number of Price Components": "numComponentPrices",
          "Number of Price Quoters": "numQuoters",
          "Minimum Number of Publishers": "minPublishers",
          "Last Slot": "lastSlot",
          "Valid Slot": "validSlot",
        } as const).map(
          ([key, value]) =>
            [
              key,
              <span key={key} className={styles.value}>
                <LiveValue
                  feedKey={feed.feedKey}
                  field={value}
                  defaultValue={feed[value]}
                />
              </span>,
            ] as const,
        ),
      ]
        .map(([field, value]) =>
          value === undefined ? undefined : ([field, value] as const),
        )
        .filter((entry) => entry !== undefined)
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([field, value]) => ({
          id: field,
          data: {
            field: <span className={styles.field}>{field}</span>,
            value:
              typeof value === "string" ? (
                <span className={styles.value}>{value}</span>
              ) : (
                value
              ),
          },
        })),
    [collator, feed],
  );

  return (
    <Table
      label="Reference Data"
      fill
      stickyHeader
      className={styles.referenceData ?? ""}
      columns={[
        {
          id: "field",
          name: "Field",
          alignment: "left",
          isRowHeader: true,
          sticky: true,
        },
        { id: "value", name: "Value", fill: true, alignment: "left" },
      ]}
      rows={rows}
    />
  );
};
