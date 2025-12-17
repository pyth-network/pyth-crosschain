import { type Cluster, clients } from ".";

export const getPythMetadata = async (cluster: Cluster) => {
  return clients[cluster].getData();
};
