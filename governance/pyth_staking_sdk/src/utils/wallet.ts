import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";

export const DummyWallet: AnchorWallet = {
  publicKey: Keypair.generate().publicKey,
  signTransaction: () => {
    throw new Error("Cannot sign transaction without a wallet");
  },
  signAllTransactions: () => {
    throw new Error("Cannot sign transactions without a wallet");
  },
};
