import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";

import { PublishersCard } from "./publishers-card";
import { getRankings } from "../../services/clickhouse";
import { getData } from "../../services/pyth";
import { PublisherIcon } from "../PublisherIcon";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const Publishers = async ({ params }: Props) => {
  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const [data, rankings] = await Promise.all([getData(), getRankings(symbol)]);
  const feed = data.find((feed) => feed.symbol === symbol);

  return feed ? (
    <PublishersCard
      priceComponents={rankings.map((ranking) => {
        const knownPublisher = lookupPublisher(ranking.publisher);
        return {
          id: ranking.publisher,
          score: ranking.final_score,
          isTest: ranking.cluster === "pythtest-conformance",
          uptimeScore: ranking.uptime_score,
          deviationPenalty: ranking.deviation_penalty,
          deviationScore: ranking.deviation_score,
          stalledPenalty: ranking.stalled_penalty,
          stalledScore: ranking.stalled_score,
          ...(knownPublisher && {
            name: knownPublisher.name,
            icon: <PublisherIcon knownPublisher={knownPublisher} />,
          }),
        };
      })}
    />
  ) : (
    notFound()
  );
};
