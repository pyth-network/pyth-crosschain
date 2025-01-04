"use client";

import { PlusMinus } from "@phosphor-icons/react/dist/ssr/PlusMinus";
import { useLogger } from "@pythnetwork/app-logger";
import type { PriceData, PriceComponent } from "@pythnetwork/client";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useMap } from "@react-hookz/web";
import { PublicKey } from "@solana/web3.js";
import {
  type ComponentProps,
  type ReactNode,
  use,
  createContext,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import { useNumberFormatter, useDateFormatter } from "react-aria";

import styles from "./index.module.scss";
import {
  Cluster,
  subscribe,
  getAssetPricesFromAccounts,
} from "../../services/pyth";

export const SKELETON_WIDTH = 20;

const LivePricesContext = createContext<
  ReturnType<typeof usePriceData> | undefined
>(undefined);

type LivePricesProviderProps = Omit<
  ComponentProps<typeof LivePricesContext>,
  "value"
>;

export const LivePricesProvider = (props: LivePricesProviderProps) => {
  const priceData = usePriceData();

  return <LivePricesContext value={priceData} {...props} />;
};

export const useLivePrice = (feedKey: string) => {
  const { priceData, prevPriceData, addSubscription, removeSubscription } =
    useLivePrices();

  useEffect(() => {
    addSubscription(feedKey);
    return () => {
      removeSubscription(feedKey);
    };
  }, [addSubscription, removeSubscription, feedKey]);

  const current = priceData.get(feedKey);
  const prev = prevPriceData.get(feedKey);

  return { current, prev };
};

export const useLivePriceComponent = (
  feedKey: string,
  publisherKeyAsBase58: string,
) => {
  const { current, prev } = useLivePrice(feedKey);
  const publisherKey = useMemo(
    () => new PublicKey(publisherKeyAsBase58),
    [publisherKeyAsBase58],
  );

  return {
    current: current?.priceComponents.find((component) =>
      component.publisher.equals(publisherKey),
    ),
    prev: prev?.priceComponents.find((component) =>
      component.publisher.equals(publisherKey),
    ),
  };
};

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
  const { prev, current } = useLivePrice(feedKey);
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
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });

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
  const { current } = useLivePrice(feedKey);
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
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });

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
  const { current } = useLivePrice(feedKey);
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
  const { current } = useLivePrice(feedKey);

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

const usePriceData = () => {
  const feedSubscriptions = useMap<string, number>([]);
  const [feedKeys, setFeedKeys] = useState<string[]>([]);
  const prevPriceData = useMap<string, PriceData>([]);
  const priceData = useMap<string, PriceData>([]);
  const logger = useLogger();

  useEffect(() => {
    // First, we initialize prices with the last available price.  This way, if
    // there's any symbol that isn't currently publishing prices (e.g. the
    // markets are closed), we will still display the last published price for
    // that symbol.
    const uninitializedFeedKeys = feedKeys.filter((key) => !priceData.has(key));
    if (uninitializedFeedKeys.length > 0) {
      getAssetPricesFromAccounts(
        Cluster.Pythnet,
        uninitializedFeedKeys.map((key) => new PublicKey(key)),
      )
        .then((initialPrices) => {
          for (const [i, price] of initialPrices.entries()) {
            const key = uninitializedFeedKeys[i];
            if (key && !priceData.has(key)) {
              priceData.set(key, price);
            }
          }
        })
        .catch((error: unknown) => {
          logger.error("Failed to fetch initial prices", error);
        });
    }

    // Then, we create a subscription to update prices live.
    const connection = subscribe(
      Cluster.Pythnet,
      feedKeys.map((key) => new PublicKey(key)),
      ({ price_account }, data) => {
        if (price_account) {
          const prevData = priceData.get(price_account);
          if (prevData) {
            prevPriceData.set(price_account, prevData);
          }
          priceData.set(price_account, data);
        }
      },
    );

    connection.start().catch((error: unknown) => {
      logger.error("Failed to subscribe to prices", error);
    });
    return () => {
      connection.stop().catch((error: unknown) => {
        logger.error("Failed to unsubscribe from price updates", error);
      });
    };
  }, [feedKeys, logger, priceData, prevPriceData]);

  const addSubscription = useCallback(
    (key: string) => {
      const current = feedSubscriptions.get(key) ?? 0;
      feedSubscriptions.set(key, current + 1);
      if (current === 0) {
        setFeedKeys((prev) => [...new Set([...prev, key])]);
      }
    },
    [feedSubscriptions],
  );

  const removeSubscription = useCallback(
    (key: string) => {
      const current = feedSubscriptions.get(key);
      if (current) {
        feedSubscriptions.set(key, current - 1);
        if (current === 1) {
          setFeedKeys((prev) => prev.filter((elem) => elem !== key));
        }
      }
    },
    [feedSubscriptions],
  );

  return {
    priceData: new Map(priceData),
    prevPriceData: new Map(prevPriceData),
    addSubscription,
    removeSubscription,
  };
};

const useLivePrices = () => {
  const prices = use(LivePricesContext);
  if (prices === undefined) {
    throw new LivePricesProviderNotInitializedError();
  }
  return prices;
};

class LivePricesProviderNotInitializedError extends Error {
  constructor() {
    super("This component must be a child of <LivePricesProvider>");
    this.name = "LivePricesProviderNotInitializedError";
  }
}

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
