import { PythCluster } from "@pythnetwork/client/lib/cluster";
import { PublicKey } from "@solana/web3.js";

export const WORMHOLE_ADDRESS: Record<PythCluster, PublicKey | undefined> = {
  "mainnet-beta": new PublicKey("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"),
  pythtest: new PublicKey("EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z"),
  devnet: new PublicKey("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5"),
  pythnet: new PublicKey("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU"),
  localnet: new PublicKey("gMYYig2utAxVoXnM9UhtTWrt8e7x2SVBZqsWZJeT5Gw"),
  testnet: undefined,
  localnet: new PublicKey("gMYYig2utAxVoXnM9UhtTWrt8e7x2SVBZqsWZJeT5Gw"),
};
