import { notFound } from "next/navigation";

import { getPriceFeeds } from "./get-price-feeds";
import { PriceFeedsCard } from "./price-feeds-card";
import { parseCluster } from "../../services/pyth";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  params: Promise<{
    cluster: string;
    key: string;
  }>;
};

export const PriceFeeds = async ({ params }: Props) => {
  const { key, cluster } = await params;
  const parsedCluster = parseCluster(cluster);

  if (parsedCluster === undefined) {
    notFound();
  }
  const feeds = await getPriceFeeds(parsedCluster, key);
  const metricsTime = feeds.find((feed) => feed.ranking !== undefined)?.ranking
    ?.time;

  return (
    <PriceFeedsCard
      label="Price Feeds"
      searchPlaceholder="Feed symbol"
      metricsTime={metricsTime}
      nameLoadingSkeleton={<PriceFeedTag compact isLoading />}
      publisherKey={key}
      cluster={parsedCluster}
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
