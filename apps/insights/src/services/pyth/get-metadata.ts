import type { Cluster } from ".";
import { clients } from ".";

export const getPythMetadata = async (cluster: Cluster) => {
  return clients[cluster].getData();
};
