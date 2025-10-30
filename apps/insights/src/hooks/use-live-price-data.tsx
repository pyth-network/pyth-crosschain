"use client";

import type { PriceData } from "@pythnetwork/client";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState, useMemo } from "react";

import { Cluster, subscribe, unsubscribe } from "../services/pyth";

export const useLivePriceData = (cluster: Cluster, feedKey: string) => {
  const logger = useLogger();
  const [data, setData] = useState<{
    current: PriceData | undefined;
    prev: PriceData | undefined;
  }>({ current: undefined, prev: undefined });

  useEffect(() => {
    const subscriptionId = subscribe(
      cluster,
      new PublicKey(feedKey),
      ({ data }) => {
        setData((prev) => ({ current: data, prev: prev.current }));
      },
    );
    return () => {
      unsubscribe(cluster, subscriptionId).catch((error: unknown) => {
        logger.error(
          `Failed to remove subscription for price feed ${feedKey}`,
          error,
        );
      });
    };
  }, [cluster, feedKey, logger]);

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
    exponent: current?.exponent,
  };
};
