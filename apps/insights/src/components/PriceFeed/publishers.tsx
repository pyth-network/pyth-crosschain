import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";

import {
  getFeedForSymbolRequest,
  getPublishersForFeedRequest,
} from "../../server/pyth";
import { getRankingsBySymbol } from "../../services/clickhouse";
import { Cluster, ClusterToName } from "../../services/pyth";
import { getStatus } from "../../status";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherTag } from "../PublisherTag";
import { PublishersCard } from "./publishers-card";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const Publishers = async ({ params }: Props) => {
  const { slug } = await params;
  const symbol = decodeURIComponent(slug);

  const [feed, testFeed, pythnetPublishers, pythtestConformancePublishers] =
    await Promise.all([
      getFeedForSymbolRequest({ cluster: Cluster.Pythnet, symbol }),
      getFeedForSymbolRequest({ cluster: Cluster.PythtestConformance, symbol }),
      getPublishers(Cluster.Pythnet, symbol),
      getPublishers(Cluster.PythtestConformance, symbol),
    ]);

  const publishers = [...pythnetPublishers, ...pythtestConformancePublishers];
  const metricsTime = pythnetPublishers.find(
    (publisher) => publisher.ranking !== undefined,
  )?.ranking?.time;

  return feed === undefined ? (
    notFound()
  ) : (
    <PublishersCard
      assetClass={feed.product.asset_type}
      displaySymbol={feed.product.display_symbol}
      metricsTime={metricsTime}
      publishers={publishers.map(
        ({ ranking, publisher, status, cluster, knownPublisher }) => ({
          cluster,
          deviationScore: ranking?.deviation_score,
          feedKey:
            cluster === Cluster.Pythnet
              ? feed.product.price_account
              : (testFeed?.product.price_account ?? ""),
          firstEvaluation: ranking?.first_ranking_time,
          id: `${publisher}-${ClusterToName[cluster]}`,
          name: (
            <PublisherTag
              cluster={cluster}
              publisherKey={publisher}
              {...(knownPublisher && {
                icon: <PublisherIcon knownPublisher={knownPublisher} />,
                name: knownPublisher.name,
              })}
            />
          ),
          nameAsString: `${knownPublisher?.name ?? ""}${publisher}`,
          publisherKey: publisher,
          rank: ranking?.final_rank,
          score: ranking?.final_score,
          stalledScore: ranking?.stalled_score,
          status,
          uptimeScore: ranking?.uptime_score,
        }),
      )}
      symbol={symbol}
    />
  );
};

export const PublishersLoading = () => <PublishersCard isLoading />;

const getPublishers = async (cluster: Cluster, symbol: string) => {
  const [publishers, rankings] = await Promise.all([
    getPublishersForFeedRequest(cluster, symbol),
    getRankingsBySymbol(symbol),
  ]);

  return publishers.map((publisher) => {
    const ranking = rankings.find(
      (ranking) =>
        ranking.publisher === publisher &&
        ranking.cluster === ClusterToName[cluster],
    );

    return {
      cluster,
      knownPublisher: lookupPublisher(publisher),
      publisher,
      ranking,
      status: getStatus(ranking),
    };
  });
};
