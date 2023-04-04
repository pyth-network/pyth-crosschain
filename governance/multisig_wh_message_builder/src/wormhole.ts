import {
  importCoreWasm,
  utils as wormholeUtils,
} from "@certusone/wormhole-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { Cluster, CONFIG } from "./helper";

export type WormholeNetwork = "TESTNET" | "MAINNET" | "DEVNET";

export async function loadWormholeTools(
  cluster: Cluster,
  connection: Connection
): Promise<WormholeTools> {
  const wormholeClusterName: WormholeNetwork =
    CONFIG[cluster].wormholeClusterName;
  const wormholeAddress =
    wormholeUtils.CONTRACTS[wormholeClusterName].solana.core;
  const {
    post_message_ix,
    fee_collector_address,
    state_address,
    parse_state,
    parse_vaa,
  } = await importCoreWasm();
  const feeCollector = new PublicKey(fee_collector_address(wormholeAddress));
  const bridgeState = new PublicKey(state_address(wormholeAddress));
  const bridgeAccountInfo = await connection.getAccountInfo(bridgeState);
  const bridgeStateParsed = parse_state(bridgeAccountInfo!.data);
  const bridgeFee = bridgeStateParsed.config.fee;
  return {
    post_message_ix,
    parse_vaa,
    bridgeFee,
    feeCollector,
    wormholeAddress: new PublicKey(wormholeAddress),
  };
}

export type WormholeTools = {
  post_message_ix: any;
  parse_vaa: any;
  bridgeFee: number;
  wormholeAddress: PublicKey;
  feeCollector: PublicKey;
};

export function parse(data: string, wormholeTools: WormholeTools) {
  return wormholeTools.parse_vaa(Uint8Array.from(Buffer.from(data, "base64")));
}
