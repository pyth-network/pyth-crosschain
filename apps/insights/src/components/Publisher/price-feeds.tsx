import { getPriceFeeds } from "./get-price-feeds";
import { PriceFeedsCard } from "./price-feeds-card";
import { Cluster } from "../../services/pyth";
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
      publisherKey={key}
      priceFeeds={feeds.map(({ ranking, feed, status }) => ({
        symbol: feed.symbol,
        score: ranking?.final_score,
        uptimeScore: ranking?.uptime_score,
        deviationScore: ranking?.deviation_score,
        stalledScore: ranking?.stalled_score,
        status,
      }))}
    />
  );
};
