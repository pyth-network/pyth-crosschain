import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { Cluster } from "@solana/web3.js";

/**
 * Return whether the cluster is governed remotely or not. For example Pythnet is governed remotely by a mainnet multisig.
 */
export function isRemoteCluster(cluster: PythCluster) {
  return cluster == "pythnet" || cluster == "pythtest";
}

/**
 * For cluster that are governed remotely (ex : Pythnet from Mainnet) return the network where the multisig lives
 */
export function getMultisigCluster(cluster: PythCluster): Cluster | "localnet" {
  switch (cluster) {
    case "pythnet":
      return "mainnet-beta";
    case "pythtest":
      return "devnet";
    default:
      return cluster;
  }
}
