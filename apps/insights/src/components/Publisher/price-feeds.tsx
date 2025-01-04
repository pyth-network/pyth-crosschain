import { getPriceFeeds } from "./get-price-feeds";
import { PriceFeedsCard } from "./price-feeds-card";
import { Cluster, ClusterToName } from "../../services/pyth";
import { PriceFeedIcon } from "../PriceFeedIcon";

type Props = {
  params: Promise<{
    key: string;
  }>;
};

export const PriceFeeds = async ({ params }: Props) => {
  const { key } = await params;
  const feeds = await getPriceFeeds(Cluster.Pythnet, key);

  return (
    <PriceFeedsCard
      priceFeeds={feeds.map(({ ranking, feed, status }) => ({
        id: `${feed.product.price_account}-${ClusterToName[Cluster.Pythnet]}`,
        symbol: feed.symbol,
        displaySymbol: feed.product.display_symbol,
        score: ranking?.final_score,
        icon: <PriceFeedIcon symbol={feed.product.display_symbol} />,
        uptimeScore: ranking?.uptime_score,
        deviationPenalty: ranking?.deviation_penalty ?? undefined,
        deviationScore: ranking?.deviation_score,
        stalledPenalty: ranking?.stalled_penalty,
        stalledScore: ranking?.stalled_score,
        cluster: Cluster.Pythnet,
        status,
      }))}
    />
  );
};
