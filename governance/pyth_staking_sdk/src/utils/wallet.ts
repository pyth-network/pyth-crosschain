import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

export type PythStakingWallet = AnchorWallet & {
  sendTransaction: (
    tx: Transaction | VersionedTransaction,
    connection: Connection,
  ) => Promise<TransactionSignature>;
};

export const DummyWallet: PythStakingWallet = {
  publicKey: PublicKey.default,
  signTransaction: () => {
    throw new Error("Cannot sign transaction without a wallet");
  },
  signAllTransactions: () => {
    throw new Error("Cannot sign transactions without a wallet");
  },
  sendTransaction: () => {
    throw new Error("Cannot send transaction without a wallet");
  },
};
