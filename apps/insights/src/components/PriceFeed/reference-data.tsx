"use client";

import { Table } from "@pythnetwork/component-library/Table";
import { useMemo } from "react";
import { useCollator } from "react-aria";
import { Cluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { LiveValue } from "../LivePrices";
import styles from "./reference-data.module.scss";

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
          "Asset Type": <AssetClassBadge>{feed.assetClass}</AssetClassBadge>,
          Base: feed.base,
          "CMS Symbol": feed.cmsSymbol,
          "Contract ID": feed.contractId,
          Country: feed.country,
          "CQS Symbol": feed.cqsSymbol,
          Description: feed.description,
          "Display Symbol": feed.displaySymbol,
          "Generic Symbol": feed.genericSymbol,
          "NASDAQ Symbol": feed.nasdaqSymbol,
          "Quote Currency": feed.quoteCurrency,
          Schedule: feed.schedule,
          Symbol: feed.symbol,
          Tenor: feed.tenor,
          "Weekly Schedule": feed.weeklySchedule,
        }),
        ...Object.entries({
          Exponent: "exponent",
          "Last Slot": "lastSlot",
          "Minimum Publishers": "minPublishers",
          "Price Components": "numComponentPrices",
          "Price Quoters": "numQuoters",
          "Valid Slot": "validSlot",
        } as const).map(
          ([key, value]) =>
            [
              key,
              <span className={styles.value} key={key}>
                <LiveValue
                  cluster={Cluster.Pythnet}
                  defaultValue={feed[value]}
                  feedKey={feed.feedKey}
                  field={value}
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
          data: {
            field: <span className={styles.field}>{field}</span>,
            value:
              typeof value === "string" ? (
                <span className={styles.value}>{value}</span>
              ) : (
                value
              ),
          },
          id: field,
        })),
    [collator, feed],
  );

  return (
    <Table
      className={styles.referenceData ?? ""}
      columns={[
        {
          alignment: "left",
          id: "field",
          isRowHeader: true,
          name: "Field",
          sticky: true,
        },
        { alignment: "left", fill: true, id: "value", name: "Value" },
      ]}
      fill
      label="Reference Data"
      rows={rows}
      stickyHeader="top"
    />
  );
};
