import { getPublisherAverageScoreHistory, getPublisherRankingHistory, getPublishers, getRankingsByPublisher, getRankingsBySymbol } from "../services/clickhouse";
import { redisCache } from '../utils/cache';

export const getRankingsBySymbolCached = redisCache.define(
  "getRankingsBySymbol",
  {
    ttl: 1000 * 60 * 60 * 24,
  },
  getRankingsBySymbol,
).getRankingsBySymbol;

export const getRankingsByPublisherCached = redisCache.define(
  "getRankingsByPublisher",
  {
    ttl: 1000 * 60 * 60 * 24,
  },
  getRankingsByPublisher,
).getRankingsByPublisher;


export const getPublishersCached = redisCache.define(
  "getPublishers",
  {
    ttl: 1000 * 60 * 60 * 24,
  },
  getPublishers,
).getPublishers;

export const getPublisherAverageScoreHistoryCached = redisCache.define(
  "getPublisherAverageScoreHistory",
  {
    ttl: 1000 * 60 * 60 * 24,
  },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  getPublisherAverageScoreHistory,
).getPublisherAverageScoreHistory as typeof getPublisherAverageScoreHistory;

export const getPublisherRankingHistoryCached = redisCache.define(
  "getPublisherRankingHistory",
  {
    ttl: 1000 * 60 * 60 * 24,
  },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  getPublisherRankingHistory,
).getPublisherRankingHistory as typeof getPublisherRankingHistory;
