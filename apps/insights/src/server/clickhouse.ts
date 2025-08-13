import { getPublisherAverageScoreHistory, getPublisherRankingHistory, getPublishers, getRankingsByPublisher, getRankingsBySymbol } from "../services/clickhouse";
import { redisCache } from '../utils/cache';

export const getRankingsBySymbolCached = redisCache.define(
  "getRankingsBySymbol",
  getRankingsBySymbol,
).getRankingsBySymbol;

export const getRankingsByPublisherCached = redisCache.define(
  "getRankingsByPublisher",
  getRankingsByPublisher,
).getRankingsByPublisher;


export const getPublishersCached = redisCache.define(
  "getPublishers",
  getPublishers,
).getPublishers;

export const getPublisherAverageScoreHistoryCached = redisCache.define(
  "getPublisherAverageScoreHistory",
  getPublisherAverageScoreHistory
).getPublisherAverageScoreHistory

export const getPublisherRankingHistoryCached = redisCache.define(
  "getPublisherRankingHistory",
  getPublisherRankingHistory
).getPublisherRankingHistory
