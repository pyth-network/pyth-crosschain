import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { Cluster } from "@solana/web3.js";

/**
 * Return whether the cluster is governed remotely or not. For example Pythnet is governed remotely by a mainnet multisig.
 */
export function isRemoteCluster(cluster: PythCluster) {
  return (
    cluster == "pythnet" ||
    cluster == "pythtest-conformance" ||
    cluster == "pythtest-crosschain"
  );
}

/**
 * For cluster that are governed remotely (ex : Pythnet from Mainnet) return the network where the multisig lives
 */
export function getMultisigCluster(cluster: PythCluster): Cluster | "localnet" {
  switch (cluster) {
    case "pythnet":
      return "mainnet-beta";
    case "pythtest-conformance":
      return "devnet";
    case "pythtest-crosschain":
      return "devnet";
    default:
      return cluster;
  }
}

export function getMaximumNumberOfPublishers(cluster: PythCluster) {
  switch (cluster) {
    case "mainnet-beta":
      return 32;
    case "devnet":
      return 32;
    case "testnet":
      return 32;
    case "pythnet":
      return 64;
    case "pythtest-conformance":
      return 64;
    case "pythtest-crosschain":
      return 64;
    case "localnet":
      return 32;
  }
}
