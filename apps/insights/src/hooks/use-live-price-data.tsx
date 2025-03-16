"use client";

import { useLogger } from "@pythnetwork/app-logger";
import type { PriceData } from "@pythnetwork/client";
import { useMap } from "@react-hookz/web";
import { PublicKey } from "@solana/web3.js";
import type { ComponentProps } from "react";
import {
  use,
  createContext,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from "react";

import {
  Cluster,
  subscribe,
  getAssetPricesFromAccounts,
} from "../services/pyth";

export const SKELETON_WIDTH = 20;

const LivePriceDataContext = createContext<
  ReturnType<typeof usePriceData> | undefined
>(undefined);

type LivePriceDataProviderProps = Omit<
  ComponentProps<typeof LivePriceDataContext>,
  "value"
>;

export const LivePriceDataProvider = (props: LivePriceDataProviderProps) => {
  const priceData = usePriceData();

  return <LivePriceDataContext value={priceData} {...props} />;
};

export const useLivePriceData = (cluster: Cluster, feedKey: string) => {
  const { priceData, prevPriceData, addSubscription, removeSubscription } =
    useLivePriceDataContext()[cluster];

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
  cluster: Cluster,
  feedKey: string,
  publisherKeyAsBase58: string,
) => {
  const { current, prev } = useLivePriceData(cluster, feedKey);
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

const usePriceData = () => {
  const pythnetPriceData = usePriceDataForCluster(Cluster.Pythnet);
  const pythtestPriceData = usePriceDataForCluster(Cluster.PythtestConformance);

  return {
    [Cluster.Pythnet]: pythnetPriceData,
    [Cluster.PythtestConformance]: pythtestPriceData,
  };
};

const usePriceDataForCluster = (cluster: Cluster) => {
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
        cluster,
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
      cluster,
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
  }, [feedKeys, logger, priceData, prevPriceData, cluster]);

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

const useLivePriceDataContext = () => {
  const prices = use(LivePriceDataContext);
  if (prices === undefined) {
    throw new LivePriceDataProviderNotInitializedError();
  }
  return prices;
};

class LivePriceDataProviderNotInitializedError extends Error {
  constructor() {
    super("This component must be a child of <LivePriceDataProvider>");
    this.name = "LivePriceDataProviderNotInitializedError";
  }
}
