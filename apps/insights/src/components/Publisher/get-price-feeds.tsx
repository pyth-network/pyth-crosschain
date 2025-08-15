import { getFeedsForPublisherRequest } from "../../server/pyth";
import { getRankingsByPublisher } from "../../services/clickhouse";
import { Cluster, ClusterToName } from "../../services/pyth";
import { getStatus } from "../../status";

export const getPriceFeeds = async (cluster: Cluster, key: string) => {
  const [feeds, rankings] = await Promise.all([
    getFeedsForPublisherRequest(cluster, key),
    getRankingsByPublisher(key),
  ]);
  return feeds.map((feed) => {
    const ranking = rankings.find(
      (ranking) =>
        ranking.symbol === feed.symbol &&
        ranking.cluster === ClusterToName[cluster],
    );
    return {
      ranking,
      feed,
      status: getStatus(ranking),
    };
  });
};
