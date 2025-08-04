import { Cluster, getFeeds, getPublishersForFeed } from "../services/pyth";

export const getFeedsCached = async (cluster: Cluster) => {
  "use cache";
  return getFeeds(cluster);
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  "use cache";
  return getPublishersForFeed(cluster, symbol);
};