import { clients, Cluster } from ".";

export const getPythMetadata = async (cluster: Cluster) => {
  return clients[cluster].getData();
};
