import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";

import { PublishersCard } from "./publishers-card";
import { getRankingsBySymbol } from "../../services/clickhouse";
import {
  Cluster,
  ClusterToName,
  getFeeds,
  getPublishersForFeed,
} from "../../services/pyth";
import { getStatus } from "../../status";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherTag } from "../PublisherTag";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const Publishers = async ({ params }: Props) => {
  const { slug } = await params;
  const symbol = decodeURIComponent(slug);
  const [
    feeds,
    pythnetPublishers, // , pythtestConformancePublishers
  ] = await Promise.all([
    getFeeds(Cluster.Pythnet),
    getPublishers(Cluster.Pythnet, symbol),
    // getPublishers(Cluster.PythtestConformance, symbol),
  ]);
  const feed = feeds.find((feed) => feed.symbol === symbol);
  // const publishers = [...pythnetPublishers, ...pythtestConformancePublishers];
  const publishers = [...pythnetPublishers];
  const metricsTime = pythnetPublishers.find(
    (publisher) => publisher.ranking !== undefined,
  )?.ranking?.time;

  return feed === undefined ? (
    notFound()
  ) : (
    <PublishersCard
      label="Publishers"
      searchPlaceholder="Publisher key or name"
      metricsTime={metricsTime}
      nameLoadingSkeleton={<PublisherTag isLoading />}
      priceComponents={publishers.map(
        ({ ranking, publisher, status, cluster, knownPublisher }) => ({
          id: `${publisher}-${ClusterToName[Cluster.Pythnet]}`,
          feedKey: feed.product.price_account,
          score: ranking?.final_score,
          uptimeScore: ranking?.uptime_score,
          deviationScore: ranking?.deviation_score,
          stalledScore: ranking?.stalled_score,
          cluster,
          status,
          publisherKey: publisher,
          symbol,
          rank: ranking?.final_rank,
          firstEvaluation: ranking?.first_ranking_time,
          name: (
            <PublisherTag
              publisherKey={publisher}
              {...(knownPublisher && {
                name: knownPublisher.name,
                icon: <PublisherIcon knownPublisher={knownPublisher} />,
              })}
            />
          ),
          nameAsString: `${knownPublisher?.name ?? ""}${publisher}`,
        }),
      )}
    />
  );
};

const getPublishers = async (cluster: Cluster, symbol: string) => {
  const [publishers, rankings] = await Promise.all([
    getPublishersForFeed(cluster, symbol),
    getRankingsBySymbol(symbol),
  ]);

  return (
    publishers?.map((publisher) => {
      const ranking = rankings.find(
        (ranking) =>
          ranking.publisher === publisher &&
          ranking.cluster === ClusterToName[cluster],
      );

      return {
        ranking,
        publisher,
        status: getStatus(ranking),
        cluster,
        knownPublisher: lookupPublisher(publisher),
      };
    }) ?? []
  );
};
