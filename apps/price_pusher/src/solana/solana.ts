/* biome-ignore-all lint/suspicious/noExplicitAny: pre-existing; untyped Hermes and Jito errors */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HermesClient } from "@pythnetwork/hermes-client";
import {
  parseAccumulatorUpdateData,
  sliceAccumulatorUpdateData,
} from "@pythnetwork/price-service-sdk";
import type { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { InstructionWithEphemeralSigners } from "@pythnetwork/solana-utils";
import {
  sendAndConfirmSerializedTransaction,
  sendTransactionsJito,
} from "@pythnetwork/solana-utils";
import type {
  AddressLookupTableAccount,
  Keypair,
  Signer,
  TransactionInstruction,
} from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
// web3.js 1.x can read v1 transactions but not build them, so v1 transactions are built with web3.js 3.x.
// The Anchor programs in `PythSolanaReceiver` still produce web3.js 1.x instructions.
import * as web3V3 from "@solana/web3.js-v3";
import bs58 from "bs58";
import type { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import type { Logger } from "pino";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";

const HEALTH_CHECK_TIMEOUT_SECONDS = 60;

/**
 * The maximum size of a serialized v1 transaction (SIMD-0385).
 */
const V1_TRANSACTION_SIZE_LIMIT = 4096;

/**
 * The maximum number of compute units a transaction can request.
 */
const MAX_COMPUTE_UNITS_PER_TRANSACTION = 1_400_000;

/**
 * The maximum size of the account data a transaction can load. A v1 transaction that does not set
 * `loadedAccountsDataSizeLimit` fails with `MaxLoadedAccountsDataSizeExceeded`, so the pusher sets it to the
 * maximum, which is the default for legacy and v0 transactions. The programs of a price update load about 3 MB.
 */
const MAX_LOADED_ACCOUNTS_DATA_SIZE_BYTES = 64 * 1024 * 1024;

/**
 * The maximum number of accounts a transaction can lock.
 */
const MAX_ACCOUNT_LOCKS_PER_TRANSACTION = 64;

/**
 * An unsigned v1 transaction, plus the ephemeral signers that must sign it with the payer.
 */
export type V1TransactionWithEphemeralSigners = {
  tx: web3V3.VersionedTransaction;
  signers: Signer[];
};

function toV3Instruction(
  instruction: TransactionInstruction,
): web3V3.TransactionInstruction {
  return new web3V3.TransactionInstruction({
    data: Uint8Array.from(instruction.data),
    keys: instruction.keys.map((key) => ({
      isSigner: key.isSigner,
      isWritable: key.isWritable,
      pubkey: new web3V3.PublicKey(key.pubkey.toBase58()),
    })),
    programId: new web3V3.PublicKey(instruction.programId.toBase58()),
  });
}

export class SolanaPriceListener extends ChainPriceListener {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private shardId: number,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
  }

  // Checking the health of the Solana connection by checking the last block time
  // and ensuring it is not older than 30 seconds.
  private async checkHealth() {
    const slot = await this.pythSolanaReceiver.connection.getSlot("finalized");
    try {
      const blockTime =
        await this.pythSolanaReceiver.connection.getBlockTime(slot);
      if (
        (blockTime === null ||
          blockTime < Date.now() / 1000 - HEALTH_CHECK_TIMEOUT_SECONDS) &&
        blockTime !== null
      ) {
        this.logger.warn(
          `Solana connection is behind by ${(
            Date.now() / 1000 - blockTime
          ).toString()} seconds`,
        );
      }
    } catch (error) {
      this.logger.error({ err: error }, "checkHealth failed");
    }
  }

  override async start() {
    // Frequently check the RPC connection to ensure it is healthy
    setInterval(() => void this.checkHealth(), 5000);

    await super.start();
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceFeedAccount =
        await this.pythSolanaReceiver.fetchPriceFeedAccount(
          this.shardId,
          Buffer.from(priceId, "hex"),
        );
      this.logger.debug(
        `Polled a Solana on chain price for feed ${
          this.priceIdToAlias.get(priceId)?.toString() ?? ""
        } (${priceId}).`,
      );
      return priceFeedAccount
        ? {
            conf: priceFeedAccount.priceMessage.conf.toString(),
            price: priceFeedAccount.priceMessage.price.toString(),
            publishTime: priceFeedAccount.priceMessage.publishTime.toNumber(),
          }
        : undefined;
    } catch (error) {
      this.logger.error(
        { err: error, priceId },
        `Polling on-chain price failed.`,
      );
      return undefined;
    }
  }
}

/**
 * Pushes price updates with v1 transactions (SIMD-0385).
 *
 * Each transaction is self-contained: it creates an encoded VAA account, writes and verifies the VAA,
 * updates as many price feed accounts as fit in the transaction, and closes the encoded VAA account.
 * No on-chain state remains after the transaction, and a failed transaction leaves no account behind.
 */
export class SolanaPricePusher implements IPricePusher {
  private payerV3: Promise<web3V3.Keypair> | undefined;

  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private hermesClient: HermesClient,
    private logger: Logger,
    private shardId: number,
    private computeUnitPriceMicroLamports: number,
    private payer: Keypair,
  ) {}

  async updatePriceFeed(priceIds: string[]): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    const shuffledPriceIds = priceIds
      .map((x) => {
        return { element: x, key: Math.random() };
      })
      .sort((a, b) => a.key - b.key)
      .map((x) => x.element);

    let priceFeedUpdateData;
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(
        shuffledPriceIds,
        {
          encoding: "base64",
          ignoreInvalidPriceIds: true,
        },
      );
      priceFeedUpdateData = response.binary.data;
    } catch (error: any) {
      this.logger.error(error, "getPriceFeedsUpdateData failed:");
      return;
    }

    try {
      const blockhash =
        await this.pythSolanaReceiver.connection.getLatestBlockhash({
          commitment: "confirmed",
        });
      const transactions = await this.buildV1Transactions(
        priceFeedUpdateData,
        blockhash.blockhash,
      );

      const signatures: string[] = [];
      for (const transaction of transactions) {
        const tx = await this.signV1Transaction(transaction);
        const [payerSignature] = tx.signatures;
        if (payerSignature === undefined) {
          throw new Error("The transaction has no payer signature");
        }
        const signature = bs58.encode(payerSignature);
        await sendAndConfirmSerializedTransaction(
          tx.serialize(),
          signature,
          blockhash,
          this.pythSolanaReceiver.connection,
          undefined,
          this.logger,
        );
        signatures.push(signature);
      }
      this.logger.debug({ signatures }, "updatePriceFeed successful");
    } catch (error: any) {
      this.logger.error(error, "updatePriceFeed failed");
      return;
    }
  }

  /**
   * Split the price updates into unsigned v1 transactions. Each transaction holds as many price updates as fit.
   *
   * @returns the transactions, and for each transaction the ephemeral signers that must sign it with the payer
   */
  async buildV1Transactions(
    priceFeedUpdateData: string[],
    recentBlockhash: string,
  ): Promise<V1TransactionWithEphemeralSigners[]> {
    const transactions: V1TransactionWithEphemeralSigners[] = [];
    for (const updateData of priceFeedUpdateData) {
      const accumulatorUpdateData = Buffer.from(updateData, "base64");
      const numUpdates = parseAccumulatorUpdateData(accumulatorUpdateData)
        .updates.length;

      let start = 0;
      while (start < numUpdates) {
        // Each transaction posts the VAA to a new encoded VAA account, so the instructions are built again for each transaction.
        const { postInstructions, closeInstructions } =
          await this.pythSolanaReceiver.buildUpdatePriceFeedInstructions(
            [
              sliceAccumulatorUpdateData(
                accumulatorUpdateData,
                start,
                numUpdates,
              ).toString("base64"),
            ],
            this.shardId,
          );
        const isUpdateInstruction = ({
          instruction,
        }: InstructionWithEphemeralSigners) =>
          instruction.programId.equals(
            this.pythSolanaReceiver.pushOracle.programId,
          );
        const postVaaInstructions = postInstructions.filter(
          (instruction) => !isUpdateInstruction(instruction),
        );
        const updateInstructions = postInstructions.filter((instruction) =>
          isUpdateInstruction(instruction),
        );

        // Add price updates one by one until the transaction does not fit anymore.
        let best:
          | { numUpdates: number; tx: web3V3.VersionedTransaction }
          | undefined;
        for (let count = 1; count <= updateInstructions.length; count++) {
          const tx = this.compileV1Transaction(
            [
              ...postVaaInstructions,
              ...updateInstructions.slice(0, count),
              ...closeInstructions,
            ],
            recentBlockhash,
          );
          if (tx === undefined) {
            break;
          }
          best = { numUpdates: count, tx };
        }
        if (best === undefined) {
          throw new Error(
            `A single price update does not fit in a v1 transaction (update ${start.toString()})`,
          );
        }
        transactions.push({
          signers: postVaaInstructions.flatMap(({ signers }) => signers),
          tx: best.tx,
        });
        start += best.numUpdates;
      }
    }
    return transactions;
  }

  /**
   * Compile instructions into an unsigned v1 transaction.
   *
   * @returns the transaction, or `undefined` if it exceeds a v1 transaction limit
   */
  compileV1Transaction(
    instructions: InstructionWithEphemeralSigners[],
    recentBlockhash: string,
  ): web3V3.VersionedTransaction | undefined {
    const computeUnits = instructions.reduce(
      (sum, { computeUnits }) => sum + (computeUnits ?? 0),
      0,
    );
    if (
      instructions.length > web3V3.V1_MAX_INSTRUCTIONS ||
      computeUnits > MAX_COMPUTE_UNITS_PER_TRANSACTION
    ) {
      return undefined;
    }

    const message = web3V3.MessageV1.compile({
      instructions: instructions.map(({ instruction }) =>
        toV3Instruction(instruction),
      ),
      payerKey: new web3V3.PublicKey(this.payer.publicKey.toBase58()),
      recentBlockhash: recentBlockhash as web3V3.Blockhash,
      // v1 transactions ignore compute budget instructions. The priority fee is the total fee in lamports.
      transactionConfig: {
        computeUnitLimit: computeUnits,
        loadedAccountsDataSizeLimit: MAX_LOADED_ACCOUNTS_DATA_SIZE_BYTES,
        priorityFeeLamports: BigInt(
          Math.ceil((this.computeUnitPriceMicroLamports * computeUnits) / 1e6),
        ),
      },
    });
    if (message.staticAccountKeys.length > MAX_ACCOUNT_LOCKS_PER_TRANSACTION) {
      return undefined;
    }

    const tx = new web3V3.VersionedTransaction(message);
    if (tx.serialize().length > V1_TRANSACTION_SIZE_LIMIT) {
      return undefined;
    }
    return tx;
  }

  /**
   * Sign a v1 transaction with the payer and its ephemeral signers.
   */
  async signV1Transaction({
    tx,
    signers,
  }: V1TransactionWithEphemeralSigners): Promise<web3V3.VersionedTransaction> {
    await tx.sign([
      await this.getPayerV3(),
      ...(await Promise.all(
        signers.map((signer) => web3V3.Keypair.fromSecretKey(signer.secretKey)),
      )),
    ]);
    return tx;
  }

  private getPayerV3(): Promise<web3V3.Keypair> {
    this.payerV3 ??= web3V3.Keypair.fromSecretKey(this.payer.secretKey);
    return this.payerV3;
  }
}

export class SolanaPricePusherJito implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private hermesClient: HermesClient,
    private logger: Logger,
    private shardId: number,
    private defaultJitoTipLamports: number,
    private dynamicJitoTips: boolean,
    private maxJitoTipLamports: number,
    private searcherClients: SearcherClient[],
    private updatesPerJitoBundle: number,
    private maxRetryTimeMs: number,
    private addressLookupTableAccount?: AddressLookupTableAccount,
  ) {}

  async getRecentJitoTipLamports(): Promise<number | undefined> {
    try {
      const response = await fetch(
        "https://bundles.jito.wtf/api/v1/bundles/tip_floor",
      );
      if (!response.ok) {
        this.logger.warn(
          { status: response.status, statusText: response.statusText },
          "getRecentJitoTips http request failed",
        );
        return undefined;
      }
      // TODO: fix this type here to be more specific
      const data = (await response.json()) as any[];
      return Math.floor(
        Number(data[0].landed_tips_50th_percentile) * LAMPORTS_PER_SOL,
      );
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.logger.warn({ err: error }, "getRecentJitoTips failed");
      return undefined;
    }
  }

  async updatePriceFeed(priceIds: string[]): Promise<void> {
    const recentJitoTip = await this.getRecentJitoTipLamports();
    const jitoTip =
      this.dynamicJitoTips && recentJitoTip !== undefined
        ? Math.max(this.defaultJitoTipLamports, recentJitoTip)
        : this.defaultJitoTipLamports;

    const cappedJitoTip = Math.min(jitoTip, this.maxJitoTipLamports);
    this.logger.debug({ cappedJitoTip }, "using jito tip of");

    let priceFeedUpdateData: string[];
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
        encoding: "base64",
      });
      priceFeedUpdateData = response.binary.data;
    } catch (error: any) {
      this.logger.error(error, "getPriceFeedsUpdateData failed");
      return;
    }

    for (let i = 0; i < priceIds.length; i += this.updatesPerJitoBundle) {
      const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder(
        {
          closeUpdateAccounts: true,
        },
        this.addressLookupTableAccount,
      );
      await transactionBuilder.addUpdatePriceFeed(
        priceFeedUpdateData.map((x) => {
          return sliceAccumulatorUpdateData(
            Buffer.from(x, "base64"),
            i,
            i + this.updatesPerJitoBundle,
          ).toString("base64");
        }),
        this.shardId,
      );

      const transactions = await transactionBuilder.buildVersionedTransactions({
        jitoTipLamports: cappedJitoTip,
        tightComputeBudget: true,
      });

      await sendTransactionsJito(
        transactions,
        this.searcherClients,
        this.pythSolanaReceiver.wallet,
        {
          maxRetryTimeMs: this.maxRetryTimeMs,
        },
        this.logger,
      );
    }
  }
}
