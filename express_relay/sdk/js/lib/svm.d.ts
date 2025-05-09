import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BidSvm, ExpressRelaySvmConfig } from "./types";
export declare function getConfigRouterPda(
  chain: string,
  router: PublicKey,
): PublicKey;
export declare function getExpressRelayMetadataPda(chain: string): PublicKey;
export declare function constructSubmitBidInstruction(
  searcher: PublicKey,
  router: PublicKey,
  permissionKey: PublicKey,
  bidAmount: anchor.BN,
  deadline: anchor.BN,
  chainId: string,
  relayerSigner: PublicKey,
  feeReceiverRelayer: PublicKey,
): Promise<TransactionInstruction>;
export declare function constructSvmBid(
  tx: Transaction,
  searcher: PublicKey,
  router: PublicKey,
  permissionKey: PublicKey,
  bidAmount: anchor.BN,
  deadline: anchor.BN,
  chainId: string,
  relayerSigner: PublicKey,
  feeReceiverRelayer: PublicKey,
): Promise<BidSvm>;
export declare function getExpressRelaySvmConfig(
  chainId: string,
  connection: Connection,
): Promise<ExpressRelaySvmConfig>;
//# sourceMappingURL=svm.d.ts.map
