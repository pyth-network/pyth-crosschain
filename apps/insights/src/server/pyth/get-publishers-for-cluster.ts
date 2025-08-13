import { getPythMetadata } from './get-metadata';
import { Cluster } from '../../services/pyth';
import { redisCache } from '../../utils/cache';

const _computePublishers = async (cluster: Cluster) => {
  const data = await getPythMetadata(cluster);
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] =
      price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
};

export const getPublishersForCluster = redisCache.define(
  "getPublishersForCluster",
  _computePublishers,
).getPublishersForCluster;