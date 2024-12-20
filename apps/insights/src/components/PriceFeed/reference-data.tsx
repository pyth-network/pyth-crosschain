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
    product: {
      display_symbol: string;
      asset_type: string;
      description: string;
      price_account: string;
      base?: string | undefined;
      country?: string | undefined;
      quote_currency?: string | undefined;
      tenor?: string | undefined;
      cms_symbol?: string | undefined;
      cqs_symbol?: string | undefined;
      nasdaq_symbol?: string | undefined;
      generic_symbol?: string | undefined;
      weekly_schedule?: string | undefined;
      schedule?: string | undefined;
      contract_id?: string | undefined;
    };
    price: {
      exponent: number;
      numComponentPrices: number;
      numQuoters: number;
      minPublishers: number;
      lastSlot: bigint;
      validSlot: bigint;
    };
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
              {feed.product.asset_type.toUpperCase()}
            </Badge>
          ),
          Base: feed.product.base,
          Description: feed.product.description,
          Symbol: feed.symbol,
          Country: feed.product.country,
          "Quote Currency": feed.product.quote_currency,
          Tenor: feed.product.tenor,
          "CMS Symbol": feed.product.cms_symbol,
          "CQS Symbol": feed.product.cqs_symbol,
          "NASDAQ Symbol": feed.product.nasdaq_symbol,
          "Generic Symbol": feed.product.generic_symbol,
          "Weekly Schedule": feed.product.weekly_schedule,
          Schedule: feed.product.schedule,
          "Contract ID": feed.product.contract_id,
          "Display Symbol": feed.product.display_symbol,
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
                <LiveValue feed={feed} field={value} />
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
