"use client";

import { PlusMinus } from "@phosphor-icons/react/dist/ssr/PlusMinus";
import { useLogger } from "@pythnetwork/app-logger";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useMap } from "@react-hookz/web";
import { PublicKey } from "@solana/web3.js";
import {
  type ComponentProps,
  use,
  createContext,
  useEffect,
  useCallback,
  useState,
} from "react";
import { useNumberFormatter } from "react-aria";

import styles from "./index.module.scss";
import { client, subscribe } from "../../pyth";

export const SKELETON_WIDTH = 20;

const LivePricesContext = createContext<
  ReturnType<typeof usePriceData> | undefined
>(undefined);

type Price = {
  price: number;
  direction: ChangeDirection;
  confidence: number;
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

export const useLivePrice = (account: string) => {
  const { priceData, addSubscription, removeSubscription } = useLivePrices();

  useEffect(() => {
    addSubscription(account);
    return () => {
      removeSubscription(account);
    };
  }, [addSubscription, removeSubscription, account]);

  return priceData.get(account);
};

export const LivePrice = ({ account }: { account: string }) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });
  const price = useLivePrice(account);

  return price === undefined ? (
    <Skeleton width={SKELETON_WIDTH} />
  ) : (
    <span className={styles.price} data-direction={price.direction}>
      {numberFormatter.format(price.price)}
    </span>
  );
};

export const LiveConfidence = ({ account }: { account: string }) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });
  const price = useLivePrice(account);

  return price === undefined ? (
    <Skeleton width={SKELETON_WIDTH} />
  ) : (
    <span className={styles.confidence}>
      <PlusMinus className={styles.plusMinus} />
      <span>{numberFormatter.format(price.confidence)}</span>
    </span>
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
              priceData.set(key, {
                price: price.aggregate.price,
                direction: "flat",
                confidence: price.aggregate.confidence,
              });
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
      ({ price_account }, { aggregate }) => {
        if (price_account) {
          const prevPrice = priceData.get(price_account)?.price;
          priceData.set(price_account, {
            price: aggregate.price,
            direction: getChangeDirection(prevPrice, aggregate.price),
            confidence: aggregate.confidence,
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
