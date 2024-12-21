"use client";

import { PlusMinus } from "@phosphor-icons/react/dist/ssr/PlusMinus";
import { useLogger } from "@pythnetwork/app-logger";
import type { PriceData } from "@pythnetwork/client";
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
import { client, subscribe } from "../../services/pyth";

export const SKELETON_WIDTH = 20;

const LivePricesContext = createContext<
  ReturnType<typeof usePriceData> | undefined
>(undefined);

type Price = PriceData & {
  direction: ChangeDirection;
};

type ChangeDirection = "up" | "down" | "flat";

type LivePricesProviderProps = Omit<
  ComponentProps<typeof LivePricesContext>,
  "value"
>;

export const LivePricesProvider = ({ ...props }: LivePricesProviderProps) => {
  const priceData = usePriceData();

  return <LivePricesContext value={priceData} {...props} />;
};

type Feed = {
  product: {
    price_account: string;
  };
};

export const useLivePrice = (feed: Feed) => {
  const { price_account } = feed.product;
  const { priceData, addSubscription, removeSubscription } = useLivePrices();

  useEffect(() => {
    addSubscription(price_account);
    return () => {
      removeSubscription(price_account);
    };
  }, [addSubscription, removeSubscription, price_account]);

  return priceData.get(price_account);
};

export const LivePrice = ({ feed }: { feed: Feed }) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });
  const price = useLivePrice(feed);

  return price === undefined ? (
    <Skeleton width={SKELETON_WIDTH} />
  ) : (
    <span className={styles.price} data-direction={price.direction}>
      {numberFormatter.format(price.aggregate.price)}
    </span>
  );
};

export const LiveConfidence = ({ feed }: { feed: Feed }) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });
  const price = useLivePrice(feed);

  return (
    <span className={styles.confidence}>
      <PlusMinus className={styles.plusMinus} />
      {price === undefined ? (
        <Skeleton width={SKELETON_WIDTH} />
      ) : (
        <span>{numberFormatter.format(price.aggregate.confidence)}</span>
      )}
    </span>
  );
};

export const LiveLastUpdated = ({ feed }: { feed: Feed }) => {
  const price = useLivePrice(feed);
  const formatterWithDate = useDateFormatter({
    dateStyle: "short",
    timeStyle: "medium",
  });
  const formatterWithoutDate = useDateFormatter({
    timeStyle: "medium",
  });
  const formattedTimestamp = useMemo(() => {
    if (price) {
      const timestamp = new Date(Number(price.timestamp * 1000n));
      return isToday(timestamp)
        ? formatterWithoutDate.format(timestamp)
        : formatterWithDate.format(timestamp);
    } else {
      return;
    }
  }, [price, formatterWithDate, formatterWithoutDate]);

  return formattedTimestamp ?? <Skeleton width={SKELETON_WIDTH} />;
};

type LiveValueProps<T extends keyof PriceData> = {
  field: T;
  feed: Feed & {
    price: Record<T, ReactNode>;
  };
};

export const LiveValue = <T extends keyof PriceData>({
  feed,
  field,
}: LiveValueProps<T>) => {
  const price = useLivePrice(feed);

  return price?.[field]?.toString() ?? feed.price[field];
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
  const priceData = useMap<string, Price>([]);
  const logger = useLogger();

  useEffect(() => {
    // First, we initialize prices with the last available price.  This way, if
    // there's any symbol that isn't currently publishing prices (e.g. the
    // markets are closed), we will still display the last published price for
    // that symbol.
    const uninitializedFeedKeys = feedKeys.filter((key) => !priceData.has(key));
    if (uninitializedFeedKeys.length > 0) {
      client
        .getAssetPricesFromAccounts(
          uninitializedFeedKeys.map((key) => new PublicKey(key)),
        )
        .then((initialPrices) => {
          for (const [i, price] of initialPrices.entries()) {
            const key = uninitializedFeedKeys[i];
            if (key) {
              priceData.set(key, { ...price, direction: "flat" });
            }
          }
        })
        .catch((error: unknown) => {
          logger.error("Failed to fetch initial prices", error);
        });
    }

    // Then, we create a subscription to update prices live.
    const connection = subscribe(
      feedKeys.map((key) => new PublicKey(key)),
      ({ price_account }, price) => {
        if (price_account) {
          const prevPrice = priceData.get(price_account)?.price;
          priceData.set(price_account, {
            ...price,
            direction: getChangeDirection(prevPrice, price.aggregate.price),
          });
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
  }, [feedKeys, logger, priceData]);

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
