import { clients, Cluster } from ".";
import { memoryOnlyCache } from "../../cache";

const _getPythMetadata = async (cluster: Cluster) => {
  return clients[cluster].getData();
};

export const getPythMetadata = memoryOnlyCache.define(
  "getPythMetadata",
  _getPythMetadata,
).getPythMetadata;
