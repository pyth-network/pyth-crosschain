import { getRankingsWithData } from "./get-rankings-with-data";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  params: Promise<{
    key: string;
  }>;
};

export const PriceFeeds = async ({ params }: Props) => {
  const { key } = await params;
  const rankingsWithData = await getRankingsWithData(key);

  return (
    <PriceComponentsCard
      defaultSort="name"
      priceComponents={rankingsWithData.map(({ ranking, feed }) => ({
        id: feed.product.price_account,
        nameAsString: feed.product.display_symbol,
        score: ranking.final_score,
        name: <PriceFeedTag compact feed={feed} />,
        uptimeScore: ranking.uptime_score,
        deviationPenalty: ranking.deviation_penalty,
        deviationScore: ranking.deviation_score,
        stalledPenalty: ranking.stalled_penalty,
        stalledScore: ranking.stalled_score,
      }))}
      nameLoadingSkeleton={<PriceFeedTag compact isLoading />}
    />
  );
};
