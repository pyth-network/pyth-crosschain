import { clients, Cluster } from ".";
// import { memoryOnlyCache } from "../../cache";

export const getPythMetadataCached = async (cluster: Cluster) => {
  return clients[cluster].getData();
};

// export const getPythMetadataCached = memoryOnlyCache.define(
//   "getPythMetadata",
//   getPythMetadata,
// ).getPythMetadata;
