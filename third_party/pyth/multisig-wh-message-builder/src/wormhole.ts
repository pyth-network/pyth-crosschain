import {
  importCoreWasm,
  utils as wormholeUtils,
} from "@certusone/wormhole-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { Cluster, CONFIG } from ".";

export type WormholeNetwork = "TESTNET" | "MAINNET" | "DEVNET";

export async function loadWormholeTools(
  cluster: Cluster,
  connection: Connection
): Promise<WormholeTools> {
  const wormholeClusterName: WormholeNetwork =
    CONFIG[cluster].wormholeClusterName;
  const wormholeAddress =
    wormholeUtils.CONTRACTS[wormholeClusterName].solana.core;
  const wasm = await importCoreWasm();
  const feeCollector = new PublicKey(
    wasm.fee_collector_address(wormholeAddress)
  );
  const bridgeState = new PublicKey(wasm.state_address(wormholeAddress));
  const bridgeAccountInfo = await connection.getAccountInfo(bridgeState);
  const bridgeStateParsed = wasm.parse_state(bridgeAccountInfo!.data);
  const bridgeFee = bridgeStateParsed.config.fee;
  return {
    wasm,
    bridgeFee,
    feeCollector,
    wormholeAddress: new PublicKey(wormholeAddress),
  };
}

export type WormholeTools = {
  wasm: any;
  bridgeFee: number;
  wormholeAddress: PublicKey;
  feeCollector: PublicKey;
};

export async function parse(data: string, wormholeTools: WormholeTools) {
  return wormholeTools.wasm.parsedVaa(
    Uint8Array.from(Buffer.from(data, "base64"))
  );
}
