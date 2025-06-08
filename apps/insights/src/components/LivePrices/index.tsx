"use client";

import { PlusMinus } from "@phosphor-icons/react/dist/ssr/PlusMinus";
import type { PriceData, PriceComponent } from "@pythnetwork/client";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useDateFormatter } from "react-aria";

import styles from "./index.module.scss";
import {
  useLivePriceComponent,
  useLivePriceData,
} from "../../hooks/use-live-price-data";
import { usePriceFormatter } from "../../hooks/use-price-formatter";
import type { Cluster } from "../../services/pyth";

export const SKELETON_WIDTH = 20;

export const LivePrice = ({
  publisherKey,
  ...props
}: {
  feedKey: string;
  publisherKey?: string | undefined;
  cluster: Cluster;
}) =>
  publisherKey === undefined ? (
    <LiveAggregatePrice {...props} />
  ) : (
    <LiveComponentPrice {...props} publisherKey={publisherKey} />
  );

const LiveAggregatePrice = ({
  feedKey,
  cluster,
}: {
  feedKey: string;
  cluster: Cluster;
}) => {
  const { prev, current } = useLivePriceData(cluster, feedKey);
  return (
    <Price current={current?.aggregate.price} prev={prev?.aggregate.price} />
  );
};

const LiveComponentPrice = ({
  feedKey,
  publisherKey,
  cluster,
}: {
  feedKey: string;
  publisherKey: string;
  cluster: Cluster;
}) => {
  const { prev, current } = useLivePriceComponent(
    cluster,
    feedKey,
    publisherKey,
  );
  return <Price current={current?.latest.price} prev={prev?.latest.price} />;
};

const Price = ({
  prev,
  current,
}: {
  prev?: number | undefined;
  current?: number | undefined;
}) =>
  current === undefined ? (
    <Skeleton width={SKELETON_WIDTH} />
  ) : (
    <span
      className={styles.price}
      data-direction={prev ? getChangeDirection(prev, current) : "flat"}
    >
      <FormattedPriceValue n={current} />
    </span>
  );

export const LiveConfidence = ({
  publisherKey,
  ...props
}: {
  feedKey: string;
  publisherKey?: string | undefined;
  cluster: Cluster;
}) =>
  publisherKey === undefined ? (
    <LiveAggregateConfidence {...props} />
  ) : (
    <LiveComponentConfidence {...props} publisherKey={publisherKey} />
  );

const LiveAggregateConfidence = ({
  feedKey,
  cluster,
}: {
  feedKey: string;
  cluster: Cluster;
}) => {
  const { current } = useLivePriceData(cluster, feedKey);
  return <Confidence confidence={current?.aggregate.confidence} />;
};

const LiveComponentConfidence = ({
  feedKey,
  publisherKey,
  cluster,
}: {
  feedKey: string;
  publisherKey: string;
  cluster: Cluster;
}) => {
  const { current } = useLivePriceComponent(cluster, feedKey, publisherKey);
  return <Confidence confidence={current?.latest.confidence} />;
};

const Confidence = ({ confidence }: { confidence?: number | undefined }) => (
  <span className={styles.confidence}>
    <PlusMinus className={styles.plusMinus} />
    {confidence === undefined ? (
      <Skeleton width={SKELETON_WIDTH} />
    ) : (
      <span>
        <FormattedPriceValue n={confidence} />
      </span>
    )}
  </span>
);

const FormattedPriceValue = ({ n }: { n: number }) => {
  const formatter = usePriceFormatter();

  return useMemo(() => formatter.format(n), [n, formatter]);
};

export const LiveLastUpdated = ({
  feedKey,
  cluster,
}: {
  feedKey: string;
  cluster: Cluster;
}) => {
  const { current } = useLivePriceData(cluster, feedKey);
  const formatterWithDate = useDateFormatter({
    dateStyle: "short",
    timeStyle: "medium",
  });
  const formatterWithoutDate = useDateFormatter({
    timeStyle: "medium",
  });
  const formattedTimestamp = useMemo(() => {
    if (current) {
      const timestamp = new Date(Number(current.timestamp * 1000n));
      return isToday(timestamp)
        ? formatterWithoutDate.format(timestamp)
        : formatterWithDate.format(timestamp);
    } else {
      return;
    }
  }, [current, formatterWithDate, formatterWithoutDate]);

  return formattedTimestamp ?? <Skeleton width={SKELETON_WIDTH} />;
};

type LiveValueProps<T extends keyof PriceData> = {
  field: T;
  feedKey: string;
  defaultValue?: ReactNode | undefined;
  cluster: Cluster;
};

export const LiveValue = <T extends keyof PriceData>({
  feedKey,
  field,
  defaultValue,
  cluster,
}: LiveValueProps<T>) => {
  const { current } = useLivePriceData(cluster, feedKey);

  if (current !== undefined || defaultValue !== undefined) {
    const value = current?.[field];
    if (typeof value === "string") {
      return value;
    } else if (typeof value === "number" || typeof value === "bigint") {
      return value.toString();
    } else {
      return value ? JSON.stringify(value) : defaultValue;
    }
  } else {
    return <Skeleton width={SKELETON_WIDTH} />;
  }
};

type LiveComponentValueProps<T extends keyof PriceComponent["latest"]> = {
  field: T;
  feedKey: string;
  publisherKey: string;
  defaultValue?: ReactNode | undefined;
  cluster: Cluster;
};

export const LiveComponentValue = <T extends keyof PriceComponent["latest"]>({
  feedKey,
  field,
  publisherKey,
  defaultValue,
  cluster,
}: LiveComponentValueProps<T>) => {
  const { current } = useLivePriceComponent(cluster, feedKey, publisherKey);

  return current !== undefined || defaultValue !== undefined ? (
    (current?.latest[field].toString() ?? defaultValue)
  ) : (
    <Skeleton width={SKELETON_WIDTH} />
  );
};

const isToday = (date: Date) => {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const getChangeDirection = (
  prevPrice: number | undefined,
  price: number,
): ChangeDirection => {
  if (prevPrice === undefined || prevPrice === price) {
    return "flat";
  } else if (prevPrice < price) {
    return "up";
  } else {
    return "down";
  }
};

type ChangeDirection = "up" | "down" | "flat";
