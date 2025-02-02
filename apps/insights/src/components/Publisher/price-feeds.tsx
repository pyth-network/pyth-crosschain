import { getPriceFeeds } from "./get-price-feeds";
import { PriceFeedsCard } from "./price-feeds-card";
import { Cluster, ClusterToName } from "../../services/pyth";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  params: Promise<{
    key: string;
  }>;
};

export const PriceFeeds = async ({ params }: Props) => {
  const { key } = await params;
  const feeds = await getPriceFeeds(Cluster.Pythnet, key);
  const metricsTime = feeds.find((feed) => feed.ranking !== undefined)?.ranking
    ?.time;

  return (
    <PriceFeedsCard
      label="Price Feeds"
      searchPlaceholder="Feed symbol"
      metricsTime={metricsTime}
      nameLoadingSkeleton={<PriceFeedTag compact isLoading />}
      priceComponents={feeds.map(({ ranking, feed, status }) => ({
        id: `${feed.product.price_account}-${ClusterToName[Cluster.Pythnet]}`,
        feedKey: feed.product.price_account,
        symbol: feed.symbol,
        score: ranking?.final_score,
        uptimeScore: ranking?.uptime_score,
        deviationScore: ranking?.deviation_score,
        stalledScore: ranking?.stalled_score,
        cluster: Cluster.Pythnet,
        status,
        publisherKey: key,
        name: (
          <PriceFeedTag
            compact
            symbol={feed.product.display_symbol}
            icon={<PriceFeedIcon symbol={feed.product.display_symbol} />}
          />
        ),
        nameAsString: feed.product.display_symbol,
      }))}
    />
  );
};
