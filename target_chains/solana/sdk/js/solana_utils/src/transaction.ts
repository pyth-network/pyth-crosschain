import { Wallet } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  PACKET_DATA_SIZE,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

/**
 * If the transaction doesn't contain a `setComputeUnitLimit` instruction, the default compute budget is 200,000 units per instruction.
 */
export const DEFAULT_COMPUTE_BUDGET_UNITS = 200000;
/**
 * The maximum size of a Solana transaction, leaving some room for the compute budget instructions.
 */
export const PACKET_DATA_SIZE_WITH_ROOM_FOR_COMPUTE_BUDGET =
  PACKET_DATA_SIZE - 52;

/**
 * An instruction with some extra information that will be used to build transactions.
 */
export type InstructionWithEphemeralSigners = {
  /** The instruction */
  instruction: TransactionInstruction;
  /** The ephemeral signers that need to sign the transaction where this instruction will be */
  signers: Signer[];
  /** The compute units that this instruction requires, useful if greater than `DEFAULT_COMPUTE_BUDGET_UNITS`  */
  computeUnits?: number;
};

/**
 * The priority fee configuration for transactions
 */
export type PriorityFeeConfig = {
  /** This is the priority fee in micro lamports, it gets passed down to `setComputeUnitPrice`  */
  computeUnitPriceMicroLamports?: number;
  tightComputeBudget?: boolean;
};

/**
 * A default priority fee configuration. Using a priority fee is helpful even when you're not writing to hot accounts.
 */
export const DEFAULT_PRIORITY_FEE_CONFIG: PriorityFeeConfig = {
  computeUnitPriceMicroLamports: 50000,
};

/**
 * Get the size of a transaction that would contain the provided array of instructions
 * This is based on {@link https://solana.com/docs/core/transactions}.
 *
 * Each transaction has the following layout :
 *
 * - A compact array of all signatures
 * - A 3-bytes message header
 * - A compact array with all the account addresses
 * - A recent blockhash
 * - A compact array of instructions
 *
 * If the transaction is a `VersionedTransaction`, it also contains an extra byte at the beginning, indicating the version and an array of `MessageAddressTableLookup` at the end.
 * We don't support Account Lookup Tables, so that array has a size of 0.
 *
 * Each instruction has the following layout :
 * - One byte indicating the index of the program in the account addresses array
 * - A compact array of indices into the account addresses array, indicating which accounts are used by the instruction
 * - A compact array of serialized instruction data
 */
export function getSizeOfTransaction(
  instructions: TransactionInstruction[],
  versionedTransaction = true
): number {
  const signers = new Set<string>();
  const accounts = new Set<string>();

  instructions.map((ix) => {
    accounts.add(ix.programId.toBase58()),
      ix.keys.map((key) => {
        if (key.isSigner) {
          signers.add(key.pubkey.toBase58());
        }
        accounts.add(key.pubkey.toBase58());
      });
  });

  const instruction_sizes: number = instructions
    .map(
      (ix) =>
        1 +
        getSizeOfCompressedU16(ix.keys.length) +
        ix.keys.length +
        getSizeOfCompressedU16(ix.data.length) +
        ix.data.length
    )
    .reduce((a, b) => a + b, 0);

  return (
    getSizeOfCompressedU16(signers.size) +
    signers.size * 64 + // array of signatures
    3 +
    getSizeOfCompressedU16(accounts.size) +
    32 * accounts.size + // array of account addresses
    32 + // recent blockhash
    getSizeOfCompressedU16(instructions.length) +
    instruction_sizes + // array of instructions
    (versionedTransaction ? 1 + getSizeOfCompressedU16(0) : 0) // we don't support Account Lookup Tables
  );
}

/**
 * Get the size of n in bytes when serialized as a CompressedU16. Compact arrays use a CompactU16 to store the length of the array.
 */
export function getSizeOfCompressedU16(n: number) {
  return 1 + Number(n >= 128) + Number(n >= 16384);
}

/**
 * This class is helpful for batching instructions into transactions in an efficient way.
 * As you add instructions, it adds them to the current transaction until it's full, then it starts a new transaction.
 */
export class TransactionBuilder {
  readonly transactionInstructions: {
    instructions: TransactionInstruction[];
    signers: Signer[];
    computeUnits: number;
  }[] = [];
  readonly payer: PublicKey;
  readonly connection: Connection;

  /** Make a new `TransactionBuilder`. It requires a `payer` to populate the `payerKey` field and a connection to populate `recentBlockhash` in the versioned transactions. */
  constructor(payer: PublicKey, connection: Connection) {
    this.payer = payer;
    this.connection = connection;
  }

  /**
   * Add an `InstructionWithEphemeralSigners` to the builder.
   */
  addInstruction(args: InstructionWithEphemeralSigners) {
    const { instruction, signers, computeUnits } = args;
    if (this.transactionInstructions.length === 0) {
      this.transactionInstructions.push({
        instructions: [instruction],
        signers: signers,
        computeUnits: computeUnits ?? 0,
      });
    } else if (
      getSizeOfTransaction([
        ...this.transactionInstructions[this.transactionInstructions.length - 1]
          .instructions,
        instruction,
      ]) <= PACKET_DATA_SIZE_WITH_ROOM_FOR_COMPUTE_BUDGET
    ) {
      this.transactionInstructions[
        this.transactionInstructions.length - 1
      ].instructions.push(instruction);
      this.transactionInstructions[
        this.transactionInstructions.length - 1
      ].signers.push(...signers);
      this.transactionInstructions[
        this.transactionInstructions.length - 1
      ].computeUnits += computeUnits ?? 0;
    } else
      this.transactionInstructions.push({
        instructions: [instruction],
        signers: signers,
        computeUnits: computeUnits ?? 0,
      });
  }

  /**
   * Add multiple `InstructionWithEphemeralSigners` to the builder.
   */
  addInstructions(instructions: InstructionWithEphemeralSigners[]) {
    for (const { instruction, signers, computeUnits } of instructions) {
      this.addInstruction({ instruction, signers, computeUnits });
    }
  }

  /**
   * Returns all the added instructions batched into versioned transactions, plus for each transaction the ephemeral signers that need to sign it
   */
  async buildVersionedTransactions(
    args: PriorityFeeConfig
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const blockhash = (
      await this.connection.getLatestBlockhash({ commitment: "confirmed" })
    ).blockhash;

    return this.transactionInstructions.map(
      ({ instructions, signers, computeUnits }) => {
        const instructionsWithComputeBudget: TransactionInstruction[] = [
          ...instructions,
        ];
        if (
          computeUnits > DEFAULT_COMPUTE_BUDGET_UNITS * instructions.length ||
          args.tightComputeBudget
        ) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
          );
        }
        if (args.computeUnitPriceMicroLamports) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: args.computeUnitPriceMicroLamports,
            })
          );
        }

        return {
          tx: new VersionedTransaction(
            new TransactionMessage({
              recentBlockhash: blockhash,
              instructions: instructionsWithComputeBudget,
              payerKey: this.payer,
            }).compileToV0Message()
          ),
          signers: signers,
        };
      }
    );
  }

  /**
   * Returns all the added instructions batched into transactions, plus for each transaction the ephemeral signers that need to sign it
   */
  buildLegacyTransactions(
    args: PriorityFeeConfig
  ): { tx: Transaction; signers: Signer[] }[] {
    return this.transactionInstructions.map(
      ({ instructions, signers, computeUnits }) => {
        const instructionsWithComputeBudget: TransactionInstruction[] = [
          ...instructions,
        ];
        if (
          computeUnits > DEFAULT_COMPUTE_BUDGET_UNITS * instructions.length ||
          args.tightComputeBudget
        ) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
          );
        }
        if (args.computeUnitPriceMicroLamports) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: args.computeUnitPriceMicroLamports,
            })
          );
        }

        return {
          tx: new Transaction().add(...instructionsWithComputeBudget),
          signers: signers,
        };
      }
    );
  }

  /**
   * Returns a set of transactions that contain the provided instructions in the same order and with efficient batching
   */
  static batchIntoLegacyTransactions(
    instructions: TransactionInstruction[],
    priorityFeeConfig: PriorityFeeConfig
  ): Transaction[] {
    const transactionBuilder = new TransactionBuilder(
      PublicKey.unique(),
      new Connection("http://placeholder.placeholder")
    ); // We only need wallet and connection for `VersionedTransaction` so we can put placeholders here
    for (const instruction of instructions) {
      transactionBuilder.addInstruction({ instruction, signers: [] });
    }
    return transactionBuilder
      .buildLegacyTransactions(priorityFeeConfig)
      .map(({ tx }) => {
        return tx;
      });
  }

  /**
   * Returns a set of versioned transactions that contain the provided instructions in the same order and with efficient batching
   */
  static async batchIntoVersionedTransactions(
    payer: PublicKey,
    connection: Connection,
    instructions: InstructionWithEphemeralSigners[],
    priorityFeeConfig: PriorityFeeConfig
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const transactionBuilder = new TransactionBuilder(payer, connection);
    transactionBuilder.addInstructions(instructions);
    return transactionBuilder.buildVersionedTransactions(priorityFeeConfig);
  }

  /**
   * Add a priority fee to a legacy transaction
   */
  static addPriorityFee(
    transaction: Transaction,
    priorityFeeConfig: PriorityFeeConfig
  ) {
    if (priorityFeeConfig.computeUnitPriceMicroLamports) {
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFeeConfig.computeUnitPriceMicroLamports,
        })
      );
    }
  }
}

export const isVersionedTransaction = (
  tx: Transaction | VersionedTransaction
): tx is VersionedTransaction => {
  return "version" in tx;
};

const TX_RETRY_INTERVAL = 500;

/**
 * Send a set of transactions to the network based on https://github.com/rpcpool/optimized-txs-examples
 */
export async function sendTransactions(
  transactions: {
    tx: VersionedTransaction | Transaction;
    signers?: Signer[] | undefined;
  }[],
  connection: Connection,
  wallet: Wallet,
  maxRetries?: number
) {
  const blockhashResult = await connection.getLatestBlockhashAndContext({
    commitment: "confirmed",
  });

  // Signing logic for versioned transactions is different from legacy transactions
  for (const transaction of transactions) {
    const { signers } = transaction;
    let tx = transaction.tx;
    if (isVersionedTransaction(tx)) {
      if (signers) {
        tx.sign(signers);
      }
    } else {
      tx.feePayer = tx.feePayer ?? wallet.publicKey;
      tx.recentBlockhash = blockhashResult.value.blockhash;

      if (signers) {
        for (const signer of signers) {
          tx.partialSign(signer);
        }
      }
    }

    tx = await wallet.signTransaction(tx);

    // In the following section, we wait and constantly check for the transaction to be confirmed
    // and resend the transaction if it is not confirmed within a certain time interval
    // thus handling tx retries on the client side rather than relying on the RPC
    let confirmedTx = null;
    let retryCount = 0;

    try {
      // Get the signature of the transaction with different logic for versioned transactions
      const txSignature = bs58.encode(
        isVersionedTransaction(tx)
          ? tx.signatures?.[0] || new Uint8Array()
          : tx.signature ?? new Uint8Array()
      );

      const confirmTransactionPromise = connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash: blockhashResult.value.blockhash,
          lastValidBlockHeight: blockhashResult.value.lastValidBlockHeight,
        },
        "confirmed"
      );

      confirmedTx = null;
      while (!confirmedTx) {
        confirmedTx = await Promise.race([
          confirmTransactionPromise,
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(null);
            }, TX_RETRY_INTERVAL)
          ),
        ]);
        if (confirmedTx) {
          break;
        }
        if (maxRetries && maxRetries < retryCount) {
          break;
        }
        console.log(
          "Retrying transaction: ",
          txSignature,
          " Retry count: ",
          retryCount
        );
        retryCount++;

        await connection.sendRawTransaction(tx.serialize(), {
          // Skipping preflight i.e. tx simulation by RPC as we simulated the tx above
          // This allows Triton RPCs to send the transaction through multiple pathways for the fastest delivery
          skipPreflight: true,
          // Setting max retries to 0 as we are handling retries manually
          // Set this manually so that the default is skipped
          maxRetries: 0,
          preflightCommitment: "confirmed",
          minContextSlot: blockhashResult.context.slot,
        });
      }
    } catch (error) {
      console.error(error);
    }

    if (!confirmedTx) {
      throw new Error("Failed to land the transaction");
    }
  }
}
