"use client";

import { useLogger } from "@pythnetwork/app-logger";
import type { PriceData } from "@pythnetwork/client";
import { useMap } from "@react-hookz/web";
import { PublicKey } from "@solana/web3.js";
import {
  type ComponentProps,
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

type MapKey = string;
type FeedKey = { key: string; cluster: Cluster };

const createMapKey = (key: string, cluster: Cluster): MapKey =>
  `${key}-${cluster.toString()}`;

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

export const useLivePriceData = (
  feedKey: string,
  cluster: Cluster = Cluster.Pythnet,
) => {
  const { priceData, prevPriceData, addSubscription, removeSubscription } =
    useLivePriceDataContext();

  useEffect(() => {
    addSubscription(feedKey, cluster);
    return () => {
      removeSubscription(feedKey, cluster);
    };
  }, [addSubscription, removeSubscription, feedKey, cluster]);

  const mapKey = createMapKey(feedKey, cluster);
  const current = priceData.get(mapKey);
  const prev = prevPriceData.get(mapKey);

  return { current, prev };
};

export const useLivePriceComponent = (
  feedKey: string,
  publisherKeyAsBase58: string,
  cluster: Cluster = Cluster.Pythnet,
) => {
  const { current, prev } = useLivePriceData(feedKey, cluster);
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
  const feedSubscriptions = useMap<MapKey, number>([]);
  const [feedKeys, setFeedKeys] = useState<FeedKey[]>([]);
  const prevPriceData = useMap<MapKey, PriceData>([]);
  const priceData = useMap<MapKey, PriceData>([]);
  const logger = useLogger();

  useEffect(() => {
    // First, we initialize prices with the last available price.  This way, if
    // there's any symbol that isn't currently publishing prices (e.g. the
    // markets are closed), we will still display the last published price for
    // that symbol.
    const uninitializedFeeds = feedKeys.filter(
      ({ key, cluster }) => !priceData.has(createMapKey(key, cluster)),
    );
    if (uninitializedFeeds.length > 0) {
      const feedsByCluster: Record<Cluster, string[]> = {
        [Cluster.Pythnet]: [],
        [Cluster.PythtestConformance]: [],
      };
      for (const { key, cluster } of uninitializedFeeds) {
        feedsByCluster[cluster].push(key);
      }

      Promise.all(
        Object.entries(feedsByCluster).map(([cluster, keys]) =>
          getAssetPricesFromAccounts(
            Number(cluster) as Cluster,
            keys.map((key) => new PublicKey(key)),
          ),
        ),
      )
        .then((clusterPrices) => {
          for (const [clusterIndex, prices] of clusterPrices.entries()) {
            const cluster = Number(
              Object.keys(feedsByCluster)[clusterIndex],
            ) as Cluster;
            const keys = feedsByCluster[cluster];
            for (const [i, price] of prices.entries()) {
              const key = keys[i];
              if (key && !priceData.has(createMapKey(key, cluster))) {
                priceData.set(createMapKey(key, cluster), price);
              }
            }
          }
        })
        .catch((error: unknown) => {
          logger.error("Failed to fetch initial prices", error);
        });
    }

    // Then, we create a subscription to update prices live.
    const connections: Record<
      Cluster,
      { keys: string[]; accounts: Map<string, MapKey> }
    > = {
      [Cluster.Pythnet]: {
        keys: [],
        accounts: new Map(),
      },
      [Cluster.PythtestConformance]: {
        keys: [],
        accounts: new Map(),
      },
    };
    for (const { key, cluster } of feedKeys) {
      connections[cluster].keys.push(key);
      connections[cluster].accounts.set(key, createMapKey(key, cluster));
    }

    const subscriptions = Object.entries(connections).map(
      ([clusterStr, { keys, accounts }]) => {
        const cluster = Number(clusterStr) as Cluster;
        return subscribe(
          cluster,
          keys.map((key) => new PublicKey(key)),
          ({ price_account }, data) => {
            if (price_account) {
              const mapKey = accounts.get(price_account);
              if (mapKey) {
                const prevData = priceData.get(mapKey);
                if (prevData) {
                  prevPriceData.set(mapKey, prevData);
                }
                priceData.set(mapKey, data);
              }
            }
          },
        );
      },
    );

    Promise.all(subscriptions.map((conn) => conn.start())).catch(
      (error: unknown) => {
        logger.error("Failed to subscribe to prices", error);
      },
    );
    return () => {
      Promise.all(subscriptions.map((conn) => conn.stop())).catch(
        (error: unknown) => {
          logger.error("Failed to unsubscribe from price updates", error);
        },
      );
    };
  }, [feedKeys, logger, priceData, prevPriceData]);

  const addSubscription = useCallback(
    (key: string, cluster: Cluster) => {
      const mapKey = createMapKey(key, cluster);
      const current = feedSubscriptions.get(mapKey) ?? 0;
      feedSubscriptions.set(mapKey, current + 1);
      if (current === 0) {
        setFeedKeys((prev) => [...prev, { key, cluster }]);
      }
    },
    [feedSubscriptions],
  );

  const removeSubscription = useCallback(
    (key: string, cluster: Cluster) => {
      const mapKey = createMapKey(key, cluster);
      const current = feedSubscriptions.get(mapKey);
      if (current) {
        feedSubscriptions.set(mapKey, current - 1);
        if (current === 1) {
          setFeedKeys((prev) =>
            prev.filter((elem) => elem.key !== key || elem.cluster !== cluster),
          );
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
