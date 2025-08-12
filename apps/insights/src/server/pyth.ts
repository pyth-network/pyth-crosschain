import { Cluster, priceFeedsSchema } from "../services/pyth";
import { getFeeds } from './pyth/get-feeds';
import { getPublishersForCluster } from './pyth/get-publishers-for-cluster';

// Convenience helpers matching your previous functions
export async function getPublishersForFeedCached(
  cluster: Cluster,
  symbol: string
) {
  const map = await getPublishersForCluster(cluster);
  return map[symbol] ?? [];
}

export async function getFeedsForPublisherCached(
  cluster: Cluster,
  publisher: string
) {
  // eslint-disable-next-line no-console
  console.log('getFeedsForPublisherCached');
  const data = await getFeeds(cluster);
  return priceFeedsSchema.parse(
    data.filter(({ price }) =>
      price.priceComponents.some((c) => c.publisher === publisher)
    )
  );
}