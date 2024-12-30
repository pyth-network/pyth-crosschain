import { getRankingsWithData } from "./get-rankings-with-data";
import { PriceFeedsCard } from "./price-feeds-card";
import { PriceFeedIcon } from "../PriceFeedIcon";

type Props = {
  params: Promise<{
    key: string;
  }>;
};

export const PriceFeeds = async ({ params }: Props) => {
  const { key } = await params;
  const rankingsWithData = await getRankingsWithData(key);

  return (
    <PriceFeedsCard
      priceComponents={rankingsWithData.map(({ ranking, feed }) => ({
        id: feed.product.price_account,
        displaySymbol: feed.product.display_symbol,
        score: ranking.final_score,
        icon: <PriceFeedIcon symbol={feed.symbol} />,
        uptimeScore: ranking.uptime_score,
        deviationPenalty: ranking.deviation_penalty,
        deviationScore: ranking.deviation_score,
        stalledPenalty: ranking.stalled_penalty,
        stalledScore: ranking.stalled_score,
      }))}
    />
  );
};
