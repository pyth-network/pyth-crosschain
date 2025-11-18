"use client";

import { PlusMinus } from "@phosphor-icons/react/dist/ssr/PlusMinus";
import type { PriceData, PriceComponent } from "@pythnetwork/client";
import { PriceStatus } from "@pythnetwork/client";
import { DocumentTitle } from "@pythnetwork/component-library/DocumentTitle";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useMemo } from "react";
import { useDateFormatter } from "react-aria";

import styles from "./index.module.scss";
import type {
  LiveAggregatedPriceOrConfidenceProps,
  LiveComponentConfidenceProps,
  LiveComponentValueProps,
  LivePriceOrConfidenceProps,
  LiveValueProps,
  PriceProps,
} from "./types";
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
}: LivePriceOrConfidenceProps) =>
  publisherKey === undefined ? (
    <LiveAggregatePrice {...props} />
  ) : (
    <LiveComponentPrice {...props} publisherKey={publisherKey} />
  );

const LiveAggregatePrice = ({
  feedKey,
  cluster,
  ...rest
}: LiveAggregatedPriceOrConfidenceProps) => {
  const { prev, current } = useLivePriceData(cluster, feedKey);
  if (current === undefined) {
    return <Price {...rest} />;
  } else if (current.status === PriceStatus.Trading) {
    return (
      <Price
        {...rest}
        current={current.price}
        prev={prev?.price}
        exponent={current.exponent}
      />
    );
  } else {
    return (
      <Price
        {...rest}
        current={current.previousPrice}
        exponent={current.exponent}
      />
    );
  }
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
  const { prev, current, exponent } = useLivePriceComponent(
    cluster,
    feedKey,
    publisherKey,
  );
  return (
    <Price
      current={current?.latest.price}
      prev={prev?.latest.price}
      exponent={exponent}
    />
  );
};

const Price = ({
  prev,
  current,
  exponent,
  updatePageTitle = false,
}: PriceProps) => {
  /** hooks */
  const formatter = usePriceFormatter(exponent);

  if (!current) return <Skeleton width={SKELETON_WIDTH} />;

  /** local variables */
  const val = formatter.format(current);

  return (
    <>
      {updatePageTitle && <DocumentTitle prefix title={val} />}
      <span
        className={styles.price}
        data-direction={prev ? getChangeDirection(prev, current) : "flat"}
      >
        {val}
      </span>
    </>
  );
};

export const LiveConfidence = ({
  publisherKey,
  ...props
}: LivePriceOrConfidenceProps) =>
  publisherKey === undefined ? (
    <LiveAggregateConfidence {...props} />
  ) : (
    <LiveComponentConfidence {...props} publisherKey={publisherKey} />
  );

const LiveAggregateConfidence = ({
  feedKey,
  cluster,
}: LiveAggregatedPriceOrConfidenceProps) => {
  const { current } = useLivePriceData(cluster, feedKey);
  return (
    <Confidence
      confidence={
        current &&
        (current.status === PriceStatus.Trading
          ? current.confidence
          : current.previousConfidence)
      }
      exponent={current?.exponent}
    />
  );
};

const LiveComponentConfidence = ({
  feedKey,
  publisherKey,
  cluster,
}: LiveComponentConfidenceProps) => {
  const { current } = useLivePriceComponent(cluster, feedKey, publisherKey);
  const { current: priceData } = useLivePriceData(cluster, feedKey);
  return (
    <Confidence
      confidence={current?.latest.confidence}
      exponent={priceData?.exponent}
    />
  );
};

const Confidence = ({
  confidence,
  exponent,
}: {
  confidence?: number | undefined;
  exponent?: number | undefined;
}) => {
  /** hooks */
  const formatter = usePriceFormatter(exponent);

  return (
    <span className={styles.confidence}>
      <PlusMinus className={styles.plusMinus} />
      {confidence === undefined ? (
        <Skeleton width={SKELETON_WIDTH} />
      ) : (
        <span>{formatter.format(confidence)}</span>
      )}
    </span>
  );
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
      const timestamp = new Date(
        Number(
          (current.status === PriceStatus.Trading
            ? current.timestamp
            : current.previousTimestamp) * 1000n,
        ),
      );
      return isToday(timestamp)
        ? formatterWithoutDate.format(timestamp)
        : formatterWithDate.format(timestamp);
    } else {
      return;
    }
  }, [current, formatterWithDate, formatterWithoutDate]);

  return formattedTimestamp ?? <Skeleton width={SKELETON_WIDTH} />;
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
