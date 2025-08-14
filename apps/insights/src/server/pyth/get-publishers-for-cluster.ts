import { getPythMetadataCached } from './get-metadata';
import { Cluster } from '../../services/pyth';
import { redisCache } from '../../utils/cache';

const getPublishersForCluster = async (cluster: Cluster) => {
  const data = await getPythMetadataCached(cluster);
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] =
      price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
};

export const getPublishersForClusterCached = redisCache.define(
  "getPublishersForCluster",
  getPublishersForCluster,
).getPublishersForCluster;