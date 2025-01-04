import { getRankingsByPublisher } from "../../services/clickhouse";
import { type Cluster, ClusterToName, getData } from "../../services/pyth";
import { getStatus } from "../../status";

export const getPriceFeeds = async (cluster: Cluster, key: string) => {
  const [data, rankings] = await Promise.all([
    getData(cluster),
    getRankingsByPublisher(key),
  ]);
  return data
    .filter((feed) =>
      feed.price.priceComponents.some(
        (component) => component.publisher === key,
      ),
    )
    .map((feed) => {
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
