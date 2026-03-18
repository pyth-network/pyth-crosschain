import { getFeedsForPublisherRequest } from "../../server/pyth";
import { getFeedRankingsByPublisher } from "../../services/clickhouse";
import type { Cluster } from "../../services/pyth";
import { ClusterToName } from "../../services/pyth";
import { getStatus } from "../../status";

export const getPriceFeeds = async (cluster: Cluster, key: string) => {
  const [feeds, rankings] = await Promise.all([
    getFeedsForPublisherRequest(cluster, key),
    getFeedRankingsByPublisher(key),
  ]);
  return feeds.map((feed) => {
    const ranking = rankings.find(
      (ranking) =>
        ranking.symbol === feed.symbol &&
        ranking.cluster === ClusterToName[cluster],
    );
    return {
      feed,
      ranking,
      status: getStatus(ranking),
    };
  });
};
