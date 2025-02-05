"use client";

import { type ComponentProps, useCallback } from "react";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";
import { usePriceFeeds } from "../../hooks/use-price-feeds";
import { Cluster, ClusterToName } from "../../services/pyth";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = Omit<
  ComponentProps<typeof PriceComponentsCard>,
  "onPriceComponentAction" | "priceComponents"
> & {
  publisherKey: string;
  priceFeeds: (Pick<
    ComponentProps<typeof PriceComponentsCard>["priceComponents"][number],
    "score" | "uptimeScore" | "deviationScore" | "stalledScore" | "status"
  > & {
    symbol: string;
  })[];
};

export const PriceFeedsCard = ({
  priceFeeds,
  publisherKey,
  ...props
}: Props) => {
  const feeds = usePriceFeeds();
  const selectPriceFeed = useSelectPriceFeed();
  const onPriceComponentAction = useCallback(
    ({ symbol }: { symbol: string }) => selectPriceFeed?.(symbol),
    [selectPriceFeed],
  );
  return (
    <PriceComponentsCard
      onPriceComponentAction={onPriceComponentAction}
      priceComponents={priceFeeds.map((feed) => {
        const contextFeed = feeds.get(feed.symbol);
        if (contextFeed) {
          return {
            id: `${contextFeed.key}-${ClusterToName[Cluster.Pythnet]}`,
            feedKey: contextFeed.key,
            symbol: feed.symbol,
            score: feed.score,
            uptimeScore: feed.uptimeScore,
            deviationScore: feed.deviationScore,
            stalledScore: feed.stalledScore,
            cluster: Cluster.Pythnet,
            status: feed.status,
            publisherKey,
            name: <PriceFeedTag compact symbol={feed.symbol} />,
            nameAsString: contextFeed.displaySymbol,
          };
        } else {
          throw new NoSuchFeedError(feed.symbol);
        }
      })}
      {...props}
    />
  );
};

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
