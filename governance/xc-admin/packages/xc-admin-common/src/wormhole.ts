import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { PublicKey } from "@solana/web3.js";

export const WORMHOLE_ADDRESS: Record<PythCluster, PublicKey | undefined> = {
  "mainnet-beta": new PublicKey("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"),
  pythtest: new PublicKey("EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z"),
  devnet: new PublicKey("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5"),
  pythnet: new PublicKey("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU"),
  localnet: new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"),
  testnet: undefined,
};

export const WORMHOLE_API_ENDPOINT: Record<PythCluster, string | undefined> = {
  "mainnet-beta": "https://wormhole-v2-mainnet-api.certus.one",
  pythtest: "https://wormhole-v2-testnet-api.certus.one",
  devnet: "https://wormhole-v2-testnet-api.certus.one",
  pythnet: "https://wormhole-v2-mainnet-api.certus.one",
  localnet: undefined,
  testnet: undefined,
};
