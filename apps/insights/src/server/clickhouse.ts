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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error - The ACD cache lib does not have `define` correctly typed 
  getPublisherAverageScoreHistory,
).getPublisherAverageScoreHistory as typeof getPublisherAverageScoreHistory;

export const getPublisherRankingHistoryCached = redisCache.define(
  "getPublisherRankingHistory",
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error - The ACD cache lib does not have `define` correctly typed 
  getPublisherRankingHistory,
).getPublisherRankingHistory as typeof getPublisherRankingHistory;
