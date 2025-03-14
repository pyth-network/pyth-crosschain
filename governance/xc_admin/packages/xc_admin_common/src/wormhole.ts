import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { PublicKey } from "@solana/web3.js";

export const WORMHOLE_ADDRESS: Record<PythCluster, PublicKey | undefined> = {
  "mainnet-beta": new PublicKey("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"),
  "pythtest-conformance": new PublicKey(
    "EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z",
  ),
  "pythtest-crosschain": new PublicKey(
    "EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z",
  ),
  devnet: new PublicKey("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5"),
  pythnet: new PublicKey("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU"),
  localnet: new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"),
  testnet: undefined,
};

// Source : https://docs.wormhole.com/wormhole/reference/sdk-docs#mainnet-guardian-rpc
export const WORMHOLE_API_ENDPOINT: Record<PythCluster, string | undefined> = {
  "mainnet-beta": "https://api.wormholescan.io",
  "pythtest-conformance": "https://api.testnet.wormholescan.io",
  "pythtest-crosschain": "https://api.testnet.wormholescan.io",
  devnet: "https://api.testnet.wormholescan.io",
  pythnet: "https://api.wormholescan.io",
  localnet: undefined,
  testnet: undefined,
};
