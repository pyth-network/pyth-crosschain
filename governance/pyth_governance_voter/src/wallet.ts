import { readFileSync } from "node:fs";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import { loadFireblocksWallet } from "./fireblocks.js";
import { LedgerNodeWallet } from "./ledger.js";

export type WalletType = "fireblocks" | "hot" | "ledger";

export type VoterWallet = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
};

export type WalletOptions = {
  hotWalletPath?: string;
  ledgerDerivationAccount?: number;
  ledgerDerivationChange?: number;
};

export const parseWalletType = (value: string): WalletType => {
  if (value === "fireblocks" || value === "hot" || value === "ledger") {
    return value;
  }
  throw new Error(
    `Invalid --wallet "${value}"; expected one of fireblocks, hot, ledger`,
  );
};

const loadHotWallet = (path: string): Keypair =>
  Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "ascii")) as number[]),
  );

export const loadWallet = async (
  type: WalletType,
  options: WalletOptions,
  dryRun: boolean,
): Promise<VoterWallet> => {
  switch (type) {
    case "hot": {
      if (!options.hotWalletPath) {
        throw new Error("--hot-wallet-path is required for --wallet hot");
      }
      const keypair = loadHotWallet(options.hotWalletPath);
      return {
        publicKey: keypair.publicKey,
        signTransaction: (transaction) => {
          transaction.partialSign(keypair);
          return Promise.resolve(transaction);
        },
      };
    }
    case "ledger": {
      const ledger = await LedgerNodeWallet.createWallet(
        options.ledgerDerivationAccount,
        options.ledgerDerivationChange,
      );
      return {
        publicKey: ledger.publicKey,
        signTransaction: (transaction) => ledger.signTransaction(transaction),
      };
    }
    case "fireblocks": {
      return loadFireblocksWallet(dryRun);
    }
  }
};
