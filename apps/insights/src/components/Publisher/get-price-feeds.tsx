import { getRankingsByPublisher } from "../../services/clickhouse";
import {
  type Cluster,
  ClusterToName,
  getFeedsForPublisher,
} from "../../services/pyth";
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
    //if (!ranking) {
    //  console.log(`No ranking for feed: ${feed.symbol} in cluster ${ClusterToName[cluster]}`);
    //}
    return {
      ranking,
      feed,
      status: getStatus(ranking),
    };
  });
};
