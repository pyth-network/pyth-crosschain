import type { Cluster } from ".";
import { clients } from ".";

// biome-ignore lint/suspicious/useAwait: Async function returns promise for API consistency
export const getPythMetadata = async (cluster: Cluster) => {
  return clients[cluster].getData();
};
