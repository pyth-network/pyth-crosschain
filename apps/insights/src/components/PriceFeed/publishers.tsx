import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";

import { PublishersCard } from "./publishers-card";
import { getRankingsBySymbol } from "../../services/clickhouse";
import { Cluster, ClusterToName, getData } from "../../services/pyth";
import { getStatus } from "../../status";
import { PublisherIcon } from "../PublisherIcon";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const Publishers = async ({ params }: Props) => {
  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const [pythnetData, pythnetPublishers, pythtestConformancePublishers] =
    await Promise.all([
      getData(Cluster.Pythnet),
      getPublishers(Cluster.Pythnet, symbol),
      getPublishers(Cluster.PythtestConformance, symbol),
    ]);
  const feed = pythnetData.find((item) => item.symbol === symbol);

  return feed !== undefined &&
    (pythnetPublishers !== undefined ||
      pythtestConformancePublishers !== undefined) ? (
    <PublishersCard
      symbol={symbol}
      feedKey={feed.product.price_account}
      publishers={[
        ...(pythnetPublishers ?? []),
        ...(pythtestConformancePublishers ?? []),
      ]}
    />
  ) : (
    notFound()
  );
};

const getPublishers = async (cluster: Cluster, symbol: string) => {
  const [data, rankings] = await Promise.all([
    getData(cluster),
    getRankingsBySymbol(symbol),
  ]);

  return data
    .find((feed) => feed.symbol === symbol)
    ?.price.priceComponents.map(({ publisher }) => {
      const ranking = rankings.find(
        (ranking) =>
          ranking.publisher === publisher &&
          ranking.cluster === ClusterToName[cluster],
      );

      //if (!ranking) {
      //  console.log(`No ranking for publisher: ${publisher} in cluster ${ClusterToName[cluster]}`);
      //}

      const knownPublisher = publisher ? lookupPublisher(publisher) : undefined;
      return {
        id: `${publisher}-${ClusterToName[Cluster.Pythnet]}`,
        publisherKey: publisher,
        score: ranking?.final_score,
        uptimeScore: ranking?.uptime_score,
        deviationPenalty: ranking?.deviation_penalty ?? undefined,
        deviationScore: ranking?.deviation_score,
        stalledPenalty: ranking?.stalled_penalty,
        stalledScore: ranking?.stalled_score,
        rank: ranking?.final_rank,
        cluster,
        status: getStatus(ranking),
        ...(knownPublisher && {
          name: knownPublisher.name,
          icon: <PublisherIcon knownPublisher={knownPublisher} />,
        }),
      };
    });
};
