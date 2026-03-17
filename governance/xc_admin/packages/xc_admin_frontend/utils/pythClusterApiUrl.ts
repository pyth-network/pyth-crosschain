// biome-ignore-all lint/style/noProcessEnv: Standard Next.js environment configuration
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";

const CLUSTER_URLS: Record<PythCluster, string[]> = {
  devnet: [
    process.env.NEXT_PUBLIC_DEVNET_RPC || getPythClusterApiUrl("devnet"),
    "https://api.devnet.solana.com/",
  ],
  localnet: ["http://localhost:8899/"],
  "mainnet-beta": [
    process.env.NEXT_PUBLIC_MAINNET_RPC || getPythClusterApiUrl("mainnet-beta"),
    "https://pyth-network.rpcpool.com/" +
      (process.env.NEXT_PUBLIC_RPC_POOL_TOKEN || ""),
    "http://pyth-rpc1.certus.one:8899/",
    "http://pyth-rpc2.certus.one:8899/",
    "https://api.mainnet-beta.solana.com/",
  ],
  pythnet: [
    process.env.NEXT_PUBLIC_PYTHNET_RPC || getPythClusterApiUrl("pythnet"),
    "https://pythnet.rpcpool.com/",
  ],
  "pythtest-conformance": [
    process.env.NEXT_PUBLIC_PYTHTEST_RPC ||
      getPythClusterApiUrl("pythtest-conformance"),
    "https://api.pythtest.pyth.network/",
  ],
  "pythtest-crosschain": [
    process.env.NEXT_PUBLIC_PYTHTEST_RPC ||
      getPythClusterApiUrl("pythtest-crosschain"),
    "https://api.pythtest.pyth.network/",
  ],
  testnet: [
    process.env.NEXT_PUBLIC_TESTNET_RPC || getPythClusterApiUrl("testnet"),
    "https://api.testnet.solana.com/",
  ],
};

export function pythClusterApiUrls(cluster: PythCluster) {
  return Object.hasOwn(CLUSTER_URLS, cluster) ? CLUSTER_URLS[cluster] : [];
}

export function deriveWsUrl(httpUrl: string) {
  return httpUrl.startsWith("https://")
    ? "wss://" + httpUrl.slice(8)
    : "ws://" + httpUrl.slice(7);
}
