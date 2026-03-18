import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { PublicKey } from "@solana/web3.js";

export const WORMHOLE_ADDRESS: Record<PythCluster, PublicKey | undefined> = {
  devnet: new PublicKey("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5"),
  localnet: new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"),
  "mainnet-beta": new PublicKey("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"),
  pythnet: new PublicKey("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU"),
  "pythtest-conformance": new PublicKey(
    "EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z",
  ),
  "pythtest-crosschain": new PublicKey(
    "EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z",
  ),
  testnet: undefined,
};

// Source : https://docs.wormhole.com/wormhole/reference/sdk-docs#mainnet-guardian-rpc
export const WORMHOLE_API_ENDPOINT: Record<PythCluster, string | undefined> = {
  devnet: "https://api.testnet.wormholescan.io",
  localnet: undefined,
  "mainnet-beta": "https://api.wormholescan.io",
  pythnet: "https://api.wormholescan.io",
  "pythtest-conformance": "https://api.testnet.wormholescan.io",
  "pythtest-crosschain": "https://api.testnet.wormholescan.io",
  testnet: undefined,
};
