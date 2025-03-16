"use client";

import type { ComponentProps } from "react";
import { useCallback } from "react";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";
import { usePriceFeeds } from "../../hooks/use-price-feeds";
import type { Cluster } from "../../services/pyth";
import { AssetClassTag } from "../AssetClassTag";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = Omit<
  ComponentProps<typeof PriceComponentsCard>,
  "onPriceComponentAction" | "priceComponents"
> & {
  publisherKey: string;
  cluster: Cluster;
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
  cluster,
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
      extraColumns={[
        {
          id: "assetClass",
          name: "ASSET CLASS",
          alignment: "left",
          allowsSorting: true,
        },
      ]}
      nameWidth={90}
      priceComponents={priceFeeds.map((feed) => {
        const contextFeed = feeds.get(feed.symbol);
        if (contextFeed) {
          return {
            id: contextFeed.key[cluster],
            feedKey: contextFeed.key[cluster],
            symbol: feed.symbol,
            score: feed.score,
            uptimeScore: feed.uptimeScore,
            deviationScore: feed.deviationScore,
            stalledScore: feed.stalledScore,
            cluster,
            status: feed.status,
            publisherKey,
            name: <PriceFeedTag compact symbol={feed.symbol} />,
            nameAsString: contextFeed.displaySymbol,
            assetClass: <AssetClassTag symbol={feed.symbol} />,
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
