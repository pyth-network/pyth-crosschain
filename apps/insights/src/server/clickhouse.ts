
import { getPublisherAverageScoreHistory, getPublisherRankingHistory, getPublishers, getRankingsByPublisher, getRankingsBySymbol } from "../services/clickhouse";
import { Cluster } from "../services/pyth";
import { createChunkedCacheFetcher, fetchAllChunks } from '../utils/cache';


const _getRankingsBySymbol = createChunkedCacheFetcher(async (symbol: string) => {
  return getRankingsBySymbol(symbol);
}, 'getRankingsBySymbol');

export const getRankingsBySymbolCached = async (symbol: string) => {
  return fetchAllChunks<ReturnType<typeof getRankingsBySymbol>, [string]>(_getRankingsBySymbol, symbol);
};

const _getRankingsByPublisher = createChunkedCacheFetcher(async (publisherKey: string) => {
  return getRankingsByPublisher(publisherKey);
}, 'getRankingsByPublisher');

export const getRankingsByPublisherCached = async (publisherKey: string) => {
  return fetchAllChunks<ReturnType<typeof getRankingsByPublisher>, [string]>(_getRankingsByPublisher, publisherKey);
};

const _getPublisherAverageScoreHistory = createChunkedCacheFetcher(async (cluster: Cluster, key: string) => {
  return getPublisherAverageScoreHistory(cluster, key);
}, 'getPublisherAverageScoreHistory');

export const getPublisherAverageScoreHistoryCached = async (cluster: Cluster, key: string) => {
  return fetchAllChunks<ReturnType<typeof getPublisherAverageScoreHistory>, [Cluster, string]>(_getPublisherAverageScoreHistory, cluster, key);
};

const _getPublisherRankingHistory = createChunkedCacheFetcher(async (cluster: Cluster, key: string) => {
  return getPublisherRankingHistory(cluster, key);
}, 'getPublisherRankingHistory');

export const getPublisherRankingHistoryCached = async (cluster: Cluster, key: string) => {
  return fetchAllChunks<ReturnType<typeof getPublisherRankingHistory>, [Cluster, string]>(_getPublisherRankingHistory, cluster, key);
};

const _getPublishers = createChunkedCacheFetcher(async (cluster: Cluster) => {
  return getPublishers(cluster);
}, 'getPublishers');

export const getPublishersCached = async (cluster: Cluster) => {
  return fetchAllChunks<ReturnType<typeof getPublishers>, [Cluster]>(_getPublishers, cluster);
}