
import { clients, Cluster } from '../../services/pyth';
import { memoryOnlyCache } from '../../utils/cache';

const _getPythMetadata = async (cluster: Cluster) => {
  // Fetch fresh data from Pyth client
  return clients[cluster].getData();
};

export const getPythMetadata = memoryOnlyCache.define(
  "getPythMetadata",
  {ttl: 1000 * 60 * 60 * 24},
  _getPythMetadata,
).getPythMetadata;

