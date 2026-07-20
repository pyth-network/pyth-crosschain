import { readFileSync } from "node:fs";
import process from "node:process";
import type { Transaction } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import type { TransactionOperation } from "fireblocks-sdk";
import { FireblocksSDK, PeerType, TransactionStatus } from "fireblocks-sdk";
import { printLine } from "./log.js";
import type { ApprovalResult, VoterWallet } from "./wallet.js";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const TERMINAL_FAILURE_STATUSES = new Set<TransactionStatus>([
  TransactionStatus.CANCELLED,
  TransactionStatus.REJECTED,
  TransactionStatus.FAILED,
  TransactionStatus.BLOCKED,
  TransactionStatus.TIMEOUT,
]);

type FireblocksConfig = {
  apiKey: string;
  secretKey: string;
  vaultAccountId: string;
  assetId: string;
};

// Fireblocks credentials are supplied via env vars, never CLI flags, so they
// stay out of shell history.
const readEnv = (key: string): string | undefined => process.env[key];

const requireEnv = (key: string): string => {
  const value = readEnv(key);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key} for --wallet fireblocks`,
    );
  }
  return value;
};

const loadFireblocksConfig = (): FireblocksConfig => {
  const secretKeyPath = requireEnv("FIREBLOCKS_SECRET_KEY_PATH");
  return {
    apiKey: requireEnv("FIREBLOCKS_API_KEY"),
    assetId: readEnv("FIREBLOCKS_ASSET_ID") ?? "SOL",
    secretKey: readFileSync(secretKeyPath, "utf8"),
    vaultAccountId: requireEnv("FIREBLOCKS_VAULT_ACCOUNT_ID"),
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchVaultSolanaAddress = async (
  client: FireblocksSDK,
  config: FireblocksConfig,
): Promise<PublicKey> => {
  const addresses = await client.getDepositAddresses(
    config.vaultAccountId,
    config.assetId,
  );
  const first = addresses[0];
  if (!first) {
    throw new Error(
      `No ${config.assetId} deposit address found for Fireblocks vault ${config.vaultAccountId}`,
    );
  }
  return new PublicKey(first.address);
};

class FireblocksSigner {
  private readonly client: FireblocksSDK;
  private readonly config: FireblocksConfig;

  constructor(client: FireblocksSDK, config: FireblocksConfig) {
    this.client = client;
    this.config = config;
  }

  async submitTransaction(transaction: Transaction): Promise<string> {
    // The full unsigned transaction (with an empty signature placeholder for the
    // voter) is what the program-call API parses, co-signs, and broadcasts.
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const created = await this.client.createTransaction({
      assetId: this.config.assetId,
      extraParameters: {
        programCallData: serialized.toString("base64"),
      },
      note: "Pyth DAO governance vote",
      // PROGRAM_CALL is not in this SDK version's TransactionOperation enum, but
      // the API accepts it. Unlike RAW (which caps message size and rejected the
      // ~700-byte vote message), the Solana program-call flow hands Fireblocks
      // the whole transaction so it can parse, sign, and broadcast it — and
      // manage blockhash liveness across the approval delay.
      operation: "PROGRAM_CALL" as TransactionOperation,
      source: {
        id: this.config.vaultAccountId,
        type: PeerType.VAULT_ACCOUNT,
      },
    });

    printLine(`Fireblocks transaction created: ${created.id}`);

    return this.pollForBroadcast(created.id);
  }

  private async pollForBroadcast(txId: string): Promise<string> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let announcedHash: string | undefined;
    for (;;) {
      const tx = await this.client.getTransactionById(txId);

      if (tx.txHash && tx.txHash !== announcedHash) {
        announcedHash = tx.txHash;
        printLine(`Vote transaction broadcast: ${tx.txHash}`);
      }

      if (tx.status === TransactionStatus.COMPLETED) {
        if (!tx.txHash) {
          throw new Error(
            `Fireblocks transaction ${txId} completed without a transaction hash`,
          );
        }
        return tx.txHash;
      }

      if (TERMINAL_FAILURE_STATUSES.has(tx.status)) {
        throw new Error(
          `Fireblocks transaction ${txId} ended in terminal status ${tx.status}`,
        );
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Fireblocks transaction ${txId} did not complete within ${POLL_TIMEOUT_MS / 60_000} minutes (last status ${tx.status}); it may still be pending approval`,
        );
      }

      printLine(
        `Fireblocks transaction ${txId} status: ${tx.status}; waiting for approval/broadcast...`,
      );
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

const dryRunApprovalGuard = (): Promise<ApprovalResult> => {
  throw new Error("dry-run does not sign transactions");
};

/**
 * Resolves the Fireblocks-backed voter wallet. During a dry run no signing is
 * performed, so the Fireblocks SDK is not constructed at all when the voter
 * pubkey is supplied via `FIREBLOCKS_VOTER_PUBKEY` — guaranteeing dry-run never
 * creates a Fireblocks approval item.
 */
export const loadFireblocksWallet = async (
  dryRun: boolean,
): Promise<VoterWallet> => {
  const voterPubkeyEnv = readEnv("FIREBLOCKS_VOTER_PUBKEY");

  if (dryRun && voterPubkeyEnv) {
    return {
      approveTransaction: dryRunApprovalGuard,
      publicKey: new PublicKey(voterPubkeyEnv),
    };
  }

  const config = loadFireblocksConfig();
  const client = new FireblocksSDK(config.secretKey, config.apiKey);
  const publicKey = voterPubkeyEnv
    ? new PublicKey(voterPubkeyEnv)
    : await fetchVaultSolanaAddress(client, config);

  if (dryRun) {
    // Pubkey resolved via a read-only getDepositAddresses call; no signing.
    return { approveTransaction: dryRunApprovalGuard, publicKey };
  }

  const signer = new FireblocksSigner(client, config);
  return {
    approveTransaction: (transaction) =>
      signer
        .submitTransaction(transaction)
        .then((signature) => ({ broadcast: true, signature })),
    publicKey,
  };
};
