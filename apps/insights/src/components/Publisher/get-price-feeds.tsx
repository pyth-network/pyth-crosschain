import { getRankingsByPublisher } from "../../services/clickhouse";
import type { Cluster } from "../../services/pyth";
import { ClusterToName, getFeedsForPublisher } from "../../services/pyth";
import { getStatus } from "../../status";

export const getPriceFeeds = async (cluster: Cluster, key: string) => {
  const [feeds, rankings] = await Promise.all([
    getFeedsForPublisher(cluster, key),
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
