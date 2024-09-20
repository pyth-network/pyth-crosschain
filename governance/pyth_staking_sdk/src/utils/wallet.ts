import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

export const DummyWallet: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: () => {
    throw new Error("Cannot sign transaction without a wallet");
  },
  signAllTransactions: () => {
    throw new Error("Cannot sign transactions without a wallet");
  },
};
