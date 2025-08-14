
import { clients, Cluster } from '../../services/pyth';
import { memoryOnlyCache } from '../../utils/cache';

const getPythMetadata = async (cluster: Cluster) => {
  return clients[cluster].getData();
};

export const getPythMetadataCached = memoryOnlyCache.define(
  "getPythMetadata",
  getPythMetadata,
).getPythMetadata;

