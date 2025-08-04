
import { getPublisherAverageScoreHistory, getPublisherRankingHistory, getPublishers, getRankingsByPublisher, getRankingsBySymbol } from "../services/clickhouse";
import { Cluster } from "../services/pyth";

export const getRankingsBySymbolCached = async (symbol: string) => {
  "use cache";
  return getRankingsBySymbol(symbol);
};

export const getRankingsByPublisherCached = async (publisherKey: string) => {
  "use cache";
  return getRankingsByPublisher(publisherKey);
};

export const getPublisherAverageScoreHistoryCached = async (cluster: Cluster, key: string) => {
  "use cache";
  return getPublisherAverageScoreHistory(cluster, key);
};

export const getPublisherRankingHistoryCached = async (cluster: Cluster, key: string) => {
  "use cache";
  return getPublisherRankingHistory(cluster, key);
};

export const getPublishersCached = async (cluster: Cluster) => {
  "use cache";
  return getPublishers(cluster);
};