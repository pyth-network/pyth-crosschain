import { Cluster, getFeeds, getFeedsForPublisher, getPublishersForFeed } from "../services/pyth";

export const getFeedsCached = async (cluster: Cluster) => {
  "use cache";
  return getFeeds(cluster);
};

export const getFeedsForPublisherCached = async (cluster: Cluster, key: string) => {
  "use cache";
  return getFeedsForPublisher(cluster, key);
};

export const getPublishersForFeedCached = async (cluster: Cluster, symbol: string) => {
  "use cache";
  return getPublishersForFeed(cluster, symbol);
};