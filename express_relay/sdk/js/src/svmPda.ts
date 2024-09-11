import { PublicKey } from "@solana/web3.js";
import { SVM_CONSTANTS } from "./const";

export function getConfigRouterPda(
  chain: string,
  router: PublicKey
): PublicKey {
  const expressRelayProgram = SVM_CONSTANTS[chain].expressRelayProgram;

  return PublicKey.findProgramAddressSync(
    [Buffer.from("config_router"), router.toBuffer()],
    expressRelayProgram
  )[0];
}

export function getExpressRelayMetadataPda(chain: string): PublicKey {
  const expressRelayProgram = SVM_CONSTANTS[chain].expressRelayProgram;

  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata")],
    expressRelayProgram
  )[0];
}
