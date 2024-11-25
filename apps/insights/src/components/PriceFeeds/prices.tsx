"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useMap } from "@react-hookz/web";
import { PublicKey } from "@solana/web3.js";
import {
  type ComponentProps,
  createContext,
  useContext,
  useEffect,
} from "react";
import { useNumberFormatter } from "react-aria";

import styles from "./prices.module.scss";
import { client, subscribe } from "../../pyth";

const PriceContext = createContext<
  Map<string, [number, ChangeDirection]> | undefined
>(undefined);

type ChangeDirection = "up" | "down" | "flat";

type PriceProviderProps = Omit<ComponentProps<typeof PriceContext>, "value"> & {
  feedKeys: string[];
};

export const PriceProvider = ({ feedKeys, ...props }: PriceProviderProps) => {
  const priceData = usePriceData(feedKeys);

  return <PriceContext value={priceData} {...props} />;
};

export const Price = ({ account }: { account: string }) => {
  const numberFormatter = useNumberFormatter({ maximumSignificantDigits: 5 });
  const price = usePrices().get(account);

  return price === undefined ? (
    <Skeleton width={20} />
  ) : (
    <span className={styles.price} data-direction={price[1]}>
      {numberFormatter.format(price[0])}
    </span>
  );
};

const usePriceData = (feedKeys: string[]) => {
  const priceData = useMap<string, [number, ChangeDirection]>([]);
  const logger = useLogger();

  useEffect(() => {
    const initialFeedKeys = feedKeys.filter((key) => !priceData.has(key));
    if (initialFeedKeys.length > 0) {
      client
        .getAssetPricesFromAccounts(
          initialFeedKeys.map((key) => new PublicKey(key)),
        )
        .then((initialPrices) => {
          for (const [i, price] of initialPrices.entries()) {
            const key = initialFeedKeys[i];
            if (key && !priceData.has(key)) {
              priceData.set(key, [price.aggregate.price, "flat"]);
            }
          }
        })
        .catch((error: unknown) => {
          logger.error("Failed to fetch initial prices", error);
        });
    }

    const connection = subscribe(
      feedKeys.map((key) => new PublicKey(key)),
      ({ price_account }, { aggregate }) => {
        if (price_account) {
          const prevPrice = priceData.get(price_account)?.[0];
          priceData.set(price_account, [
            aggregate.price,
            getChangeDirection(prevPrice, aggregate.price),
          ]);
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

  return new Map(priceData);
};

const usePrices = () => {
  const prices = useContext(PriceContext);
  if (prices === undefined) {
    throw new NotInitializedError();
  }
  return prices;
};

class NotInitializedError extends Error {
  constructor() {
    super("This component must be a child of <PriceProvider>");
    this.name = "NotInitializedError";
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
