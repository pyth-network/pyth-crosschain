import { getPublisherFeeds } from "../../services/clickhouse";
import { getData } from "../../services/pyth";

export const getRankingsWithData = async (key: string) => {
  const [data, rankings] = await Promise.all([
    getData(),
    getPublisherFeeds(key),
  ]);
  const rankingsWithData = rankings.map((ranking) => {
    const feed = data.find((feed) => feed.symbol === ranking.symbol);
    if (!feed) {
      throw new NoSuchFeedError(ranking.symbol);
    }
    return { ranking, feed };
  });
  return rankingsWithData;
};

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
