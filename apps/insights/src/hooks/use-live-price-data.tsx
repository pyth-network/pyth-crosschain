"use client";

import type { PriceData } from "@pythnetwork/client";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { PublicKey } from "@solana/web3.js";
import type { ComponentProps } from "react";
import {
  use,
  createContext,
  useEffect,
  useCallback,
  useState,
  useMemo,
  useRef,
} from "react";

import {
  Cluster,
  subscribe,
  getAssetPricesFromAccounts,
} from "../services/pyth";

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
  const { addSubscription, removeSubscription } =
    useLivePriceDataContext()[cluster];

  const [data, setData] = useState<{
    current: PriceData | undefined;
    prev: PriceData | undefined;
  }>({ current: undefined, prev: undefined });

  useEffect(() => {
    addSubscription(feedKey, setData);
    return () => {
      removeSubscription(feedKey, setData);
    };
  }, [addSubscription, removeSubscription, feedKey]);

  return data;
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

type Subscription = (value: {
  current: PriceData;
  prev: PriceData | undefined;
}) => void;

const usePriceDataForCluster = (cluster: Cluster) => {
  const [feedKeys, setFeedKeys] = useState<string[]>([]);
  const feedSubscriptions = useRef<Map<string, Set<Subscription>>>(new Map());
  const priceData = useRef<Map<string, PriceData>>(new Map());
  const prevPriceData = useRef<Map<string, PriceData>>(new Map());
  const logger = useLogger();

  useEffect(() => {
    // First, we initialize prices with the last available price.  This way, if
    // there's any symbol that isn't currently publishing prices (e.g. the
    // markets are closed), we will still display the last published price for
    // that symbol.
    const uninitializedFeedKeys = feedKeys.filter(
      (key) => !priceData.current.has(key),
    );
    if (uninitializedFeedKeys.length > 0) {
      getAssetPricesFromAccounts(
        cluster,
        uninitializedFeedKeys.map((key) => new PublicKey(key)),
      )
        .then((initialPrices) => {
          for (const [i, price] of initialPrices.entries()) {
            const key = uninitializedFeedKeys[i];
            if (key && !priceData.current.has(key)) {
              priceData.current.set(key, price);
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
          const prevData = priceData.current.get(price_account);
          if (prevData) {
            prevPriceData.current.set(price_account, prevData);
          }
          priceData.current.set(price_account, data);
          for (const subscription of feedSubscriptions.current.get(
            price_account,
          ) ?? []) {
            subscription({ current: data, prev: prevData });
          }
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
  }, [feedKeys, logger, cluster]);

  const addSubscription = useCallback(
    (key: string, subscription: Subscription) => {
      const current = feedSubscriptions.current.get(key);
      if (current === undefined) {
        feedSubscriptions.current.set(key, new Set([subscription]));
        setFeedKeys((prev) => [...new Set([...prev, key])]);
      } else {
        current.add(subscription);
      }
    },
    [feedSubscriptions],
  );

  const removeSubscription = useCallback(
    (key: string, subscription: Subscription) => {
      const current = feedSubscriptions.current.get(key);
      if (current) {
        if (current.size === 0) {
          feedSubscriptions.current.delete(key);
          setFeedKeys((prev) => prev.filter((elem) => elem !== key));
        } else {
          current.delete(subscription);
        }
      }
    },
    [feedSubscriptions],
  );

  return {
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
