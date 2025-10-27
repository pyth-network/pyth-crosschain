import { getPublishers } from "./server/pyth";
import { getPublisherRankings } from "./services/clickhouse";
import type { Cluster } from "./services/pyth";

export const getPublishersWithRankings = async (cluster: Cluster) => {
  const [publishers, publisherRankings] = await Promise.all([
    getPublishers(cluster),
    getPublisherRankings(cluster),
  ]);

  return publishers
    .map((publisher) => ({
      ...publisher,
      ...publisherRankings.find((ranking) => ranking.key === publisher.key),
    }))
    .toSorted((a, b) => {
      if (a.rank === undefined) {
        return b.rank === undefined ? a.key.localeCompare(b.key) : 1;
      } else {
        return b.rank === undefined ? -1 : a.rank - b.rank;
      }
    });
};
