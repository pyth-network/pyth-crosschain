"use client";

import { PlusMinus } from "@phosphor-icons/react/dist/ssr/PlusMinus";
import type { PriceData, PriceComponent } from "@pythnetwork/client";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { type ReactNode, useMemo } from "react";
import { useNumberFormatter, useDateFormatter } from "react-aria";

import styles from "./index.module.scss";
import {
  useLivePriceComponent,
  useLivePriceData,
} from "../../hooks/use-live-price-data";

export const SKELETON_WIDTH = 20;

export const LivePrice = ({
  feedKey,
  publisherKey,
}: {
  feedKey: string;
  publisherKey?: string | undefined;
}) =>
  publisherKey ? (
    <LiveComponentPrice feedKey={feedKey} publisherKey={publisherKey} />
  ) : (
    <LiveAggregatePrice feedKey={feedKey} />
  );

const LiveAggregatePrice = ({ feedKey }: { feedKey: string }) => {
  const { prev, current } = useLivePriceData(feedKey);
  return (
    <Price current={current?.aggregate.price} prev={prev?.aggregate.price} />
  );
};

const LiveComponentPrice = ({
  feedKey,
  publisherKey,
}: {
  feedKey: string;
  publisherKey: string;
}) => {
  const { prev, current } = useLivePriceComponent(feedKey, publisherKey);
  return <Price current={current?.latest.price} prev={prev?.latest.price} />;
};

const Price = ({
  prev,
  current,
}: {
  prev?: number | undefined;
  current?: number | undefined;
}) => {
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 5 });

  return current === undefined ? (
    <Skeleton width={SKELETON_WIDTH} />
  ) : (
    <span
      className={styles.price}
      data-direction={prev ? getChangeDirection(prev, current) : "flat"}
    >
      {numberFormatter.format(current)}
    </span>
  );
};

export const LiveConfidence = ({
  feedKey,
  publisherKey,
}: {
  feedKey: string;
  publisherKey?: string | undefined;
}) =>
  publisherKey === undefined ? (
    <LiveAggregateConfidence feedKey={feedKey} />
  ) : (
    <LiveComponentConfidence feedKey={feedKey} publisherKey={publisherKey} />
  );

const LiveAggregateConfidence = ({ feedKey }: { feedKey: string }) => {
  const { current } = useLivePriceData(feedKey);
  return <Confidence confidence={current?.aggregate.confidence} />;
};

const LiveComponentConfidence = ({
  feedKey,
  publisherKey,
}: {
  feedKey: string;
  publisherKey: string;
}) => {
  const { current } = useLivePriceComponent(feedKey, publisherKey);
  return <Confidence confidence={current?.latest.confidence} />;
};

const Confidence = ({ confidence }: { confidence?: number | undefined }) => {
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 5 });

  return (
    <span className={styles.confidence}>
      <PlusMinus className={styles.plusMinus} />
      {confidence === undefined ? (
        <Skeleton width={SKELETON_WIDTH} />
      ) : (
        <span>{numberFormatter.format(confidence)}</span>
      )}
    </span>
  );
};

export const LiveLastUpdated = ({ feedKey }: { feedKey: string }) => {
  const { current } = useLivePriceData(feedKey);
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
};

export const LiveValue = <T extends keyof PriceData>({
  feedKey,
  field,
  defaultValue,
}: LiveValueProps<T>) => {
  const { current } = useLivePriceData(feedKey);

  return current?.[field]?.toString() ?? defaultValue;
};

type LiveComponentValueProps<T extends keyof PriceComponent["latest"]> = {
  field: T;
  feedKey: string;
  publisherKey: string;
  defaultValue?: ReactNode | undefined;
};

export const LiveComponentValue = <T extends keyof PriceComponent["latest"]>({
  feedKey,
  field,
  publisherKey,
  defaultValue,
}: LiveComponentValueProps<T>) => {
  const { current } = useLivePriceComponent(feedKey, publisherKey);

  return current?.latest[field].toString() ?? defaultValue;
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
