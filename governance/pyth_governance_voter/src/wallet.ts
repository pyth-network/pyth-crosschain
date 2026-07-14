import { readFileSync } from "node:fs";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import { loadFireblocksWallet } from "./fireblocks.js";
import { LedgerNodeWallet } from "./ledger.js";

export type WalletType = "fireblocks" | "hot" | "ledger";

/**
 * The outcome of asking a wallet to approve the vote transaction.
 *
 * Local wallets (hot, ledger) sign in-process and hand the signed transaction
 * back for the CLI to broadcast. Fireblocks signs *and* broadcasts the
 * transaction itself via the Solana program-call API, so it returns the
 * resulting on-chain signature and leaves nothing for the CLI to send.
 */
export type ApprovalResult =
  | { broadcast: false; transaction: Transaction }
  | { broadcast: true; signature: string };

export type VoterWallet = {
  publicKey: PublicKey;
  approveTransaction: (transaction: Transaction) => Promise<ApprovalResult>;
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
        approveTransaction: (transaction) => {
          transaction.partialSign(keypair);
          return Promise.resolve({ broadcast: false, transaction });
        },
        publicKey: keypair.publicKey,
      };
    }
    case "ledger": {
      const ledger = await LedgerNodeWallet.createWallet(
        options.ledgerDerivationAccount,
        options.ledgerDerivationChange,
      );
      return {
        approveTransaction: async (transaction) => ({
          broadcast: false,
          transaction: await ledger.signTransaction(transaction),
        }),
        publicKey: ledger.publicKey,
      };
    }
    case "fireblocks": {
      return loadFireblocksWallet(dryRun);
    }
  }
};
