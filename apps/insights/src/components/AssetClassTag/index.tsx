import { Badge } from "@pythnetwork/component-library/Badge";
import type { ComponentProps } from "react";

import { usePriceFeeds } from "../../hooks/use-price-feeds";

type Props = ComponentProps<typeof Badge> & {
  symbol: string;
};

export const AssetClassTag = ({ symbol }: Props) => {
  const feed = usePriceFeeds().get(symbol);

  if (feed) {
    return (
      <Badge variant="neutral" style="outline" size="xs">
        {feed.assetClass.toUpperCase()}
      </Badge>
    );
  } else {
    throw new NoSuchFeedError(symbol);
  }
};

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
