import { getRankingsByPublisherCached } from '../../server/clickhouse';
import { getFeedsForPublisherCached } from "../../server/pyth";
import { Cluster, ClusterToName } from "../../services/pyth";
import { getStatus } from "../../status";

export const getPriceFeeds = async (cluster: Cluster, key: string) => {
  const [feeds, rankings] = await Promise.all([
    getFeedsForPublisherCached(cluster, key),
    getRankingsByPublisherCached(key),
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
