import { getPublisherAverageScoreHistory, getPublisherRankingHistory, getPublishers, getRankingsByPublisher, getRankingsBySymbol } from "../services/clickhouse";
import { Cluster } from "../services/pyth";

export const getRankingsBySymbolCached = async (symbol: string) => {
    return getRankingsBySymbol(symbol);
};

export const getRankingsByPublisherCached = async (publisherKey: string) => {
    return getRankingsByPublisher(publisherKey);
};

export const getPublisherAverageScoreHistoryCached = async (cluster: Cluster, key: string) => {
    return getPublisherAverageScoreHistory(cluster, key);
};

export const getPublisherRankingHistoryCached = async (cluster: Cluster, key: string) => {
    return getPublisherRankingHistory(cluster, key);
};

export const getPublishersCached = async (cluster: Cluster) => {
    return getPublishers(cluster);
}