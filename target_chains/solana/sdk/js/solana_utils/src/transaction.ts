import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PACKET_DATA_SIZE,
  PublicKey,
  SignatureResult,
  Signer,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { buildJitoTipInstruction } from "./jito";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

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
  jitoTipLamports?: number;
  jitoBundleSize?: number;
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
 * After this field there is an array of indexes into the address lookup table that represents the accounts from the address lookup table used in the transaction.
 *
 * Each instruction has the following layout :
 * - One byte indicating the index of the program in the account addresses array
 * - A compact array of indices into the account addresses array, indicating which accounts are used by the instruction
 * - A compact array of serialized instruction data
 */
export function getSizeOfTransaction(
  instructions: TransactionInstruction[],
  versionedTransaction = true,
  addressLookupTable?: AddressLookupTableAccount,
): number {
  const programs = new Set<string>();
  const signers = new Set<string>();
  let accounts = new Set<string>();

  instructions.map((ix) => {
    programs.add(ix.programId.toBase58());
    accounts.add(ix.programId.toBase58());
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
        ix.data.length,
    )
    .reduce((a, b) => a + b, 0);

  let numberOfAddressLookups = 0;
  if (addressLookupTable) {
    const lookupTableAddresses = addressLookupTable.state.addresses.map(
      (address) => address.toBase58(),
    );
    const totalNumberOfAccounts = accounts.size;
    accounts = new Set(
      [...accounts].filter(
        (account) => !lookupTableAddresses.includes(account),
      ),
    );
    accounts = new Set([...accounts, ...programs, ...signers]);
    numberOfAddressLookups = totalNumberOfAccounts - accounts.size; // This number is equal to the number of accounts that are in the lookup table and are neither signers nor programs
  }

  return (
    getSizeOfCompressedU16(signers.size) +
    signers.size * 64 + // array of signatures
    3 +
    getSizeOfCompressedU16(accounts.size) +
    32 * accounts.size + // array of account addresses
    32 + // recent blockhash
    getSizeOfCompressedU16(instructions.length) +
    instruction_sizes + // array of instructions
    (versionedTransaction ? 1 + getSizeOfCompressedU16(0) : 0) + // transaction version and number of address lookup tables
    (versionedTransaction && addressLookupTable ? 32 : 0) + // address lookup table address (we only support 1 address lookup table)
    (versionedTransaction && addressLookupTable ? 2 : 0) + // number of address lookup indexes
    numberOfAddressLookups // address lookup indexes
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
  readonly addressLookupTable: AddressLookupTableAccount | undefined;

  /** Make a new `TransactionBuilder`. It requires a `payer` to populate the `payerKey` field and a connection to populate `recentBlockhash` in the versioned transactions. */
  constructor(
    payer: PublicKey,
    connection: Connection,
    addressLookupTable?: AddressLookupTableAccount,
  ) {
    this.payer = payer;
    this.connection = connection;
    this.addressLookupTable = addressLookupTable;
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
    } else {
      const sizeWithComputeUnits = getSizeOfTransaction(
        [
          ...this.transactionInstructions[
            this.transactionInstructions.length - 1
          ].instructions,
          instruction,
          buildJitoTipInstruction(this.payer, 1),
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1 }),
        ],
        true,
        this.addressLookupTable,
      );
      if (sizeWithComputeUnits <= PACKET_DATA_SIZE) {
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
    args: PriorityFeeConfig,
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const blockhash = (
      await this.connection.getLatestBlockhash({ commitment: "confirmed" })
    ).blockhash;

    const jitoBundleSize =
      args.jitoBundleSize || this.transactionInstructions.length;

    return this.transactionInstructions.map(
      ({ instructions, signers, computeUnits }, index) => {
        const instructionsWithComputeBudget: TransactionInstruction[] = [
          ...instructions,
        ];
        if (
          computeUnits > DEFAULT_COMPUTE_BUDGET_UNITS * instructions.length ||
          args.tightComputeBudget
        ) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
          );
        }
        if (args.computeUnitPriceMicroLamports) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: args.computeUnitPriceMicroLamports,
            }),
          );
        }
        if (args.jitoTipLamports && index % jitoBundleSize === 0) {
          instructionsWithComputeBudget.push(
            buildJitoTipInstruction(this.payer, args.jitoTipLamports),
          );
        }

        // This handles an edge case where a single instruction is too big and therefore needs to be by itself without any compute budget instructions or jito tips
        const instructionsToSend: TransactionInstruction[] = [];
        for (const instruction of instructionsWithComputeBudget) {
          const sizeWithInstruction = getSizeOfTransaction(
            [...instructionsToSend, instruction],
            true,
            this.addressLookupTable,
          );
          if (sizeWithInstruction > PACKET_DATA_SIZE) {
            break;
          }
          instructionsToSend.push(instruction);
        }

        return {
          tx: new VersionedTransaction(
            new TransactionMessage({
              recentBlockhash: blockhash,
              instructions: instructionsToSend,
              payerKey: this.payer,
            }).compileToV0Message(
              this.addressLookupTable ? [this.addressLookupTable] : [],
            ),
          ),
          signers: signers,
        };
      },
    );
  }

  /**
   * Returns all the added instructions batched into transactions, plus for each transaction the ephemeral signers that need to sign it
   */
  buildLegacyTransactions(
    args: PriorityFeeConfig,
  ): { tx: Transaction; signers: Signer[] }[] {
    const jitoBundleSize =
      args.jitoBundleSize || this.transactionInstructions.length;

    return this.transactionInstructions.map(
      ({ instructions, signers, computeUnits }, index) => {
        const instructionsWithComputeBudget: TransactionInstruction[] = [
          ...instructions,
        ];
        if (
          computeUnits > DEFAULT_COMPUTE_BUDGET_UNITS * instructions.length ||
          args.tightComputeBudget
        ) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
          );
        }
        if (args.computeUnitPriceMicroLamports) {
          instructionsWithComputeBudget.push(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: args.computeUnitPriceMicroLamports,
            }),
          );
        }
        if (args.jitoTipLamports && index % jitoBundleSize === 0) {
          instructionsWithComputeBudget.push(
            buildJitoTipInstruction(this.payer, args.jitoTipLamports),
          );
        }

        // This handles an edge case where a single instruction is too big and therefore needs to be by itself without any compute budget instructions or jito tips
        const instructionsToSend: TransactionInstruction[] = [];
        for (const instruction of instructionsWithComputeBudget) {
          const sizeWithInstruction = getSizeOfTransaction(
            [...instructionsToSend, instruction],
            false,
          );
          if (sizeWithInstruction > PACKET_DATA_SIZE) {
            if (instructionsToSend.length == 0) {
              throw new Error(
                `An instruction is too big to be sent in a transaction (${sizeWithInstruction} > ${PACKET_DATA_SIZE} bytes)`,
              );
            }
            break;
          }
          instructionsToSend.push(instruction);
        }

        return {
          tx: new Transaction().add(...instructionsToSend),
          signers: signers,
        };
      },
    );
  }

  /**
   * Returns a set of transactions that contain the provided instructions in the same order and with efficient batching
   */
  static batchIntoLegacyTransactions(
    instructions: TransactionInstruction[],
    priorityFeeConfig: PriorityFeeConfig,
  ): Transaction[] {
    const transactionBuilder = new TransactionBuilder(
      PublicKey.unique(),
      new Connection("http://placeholder.placeholder"),
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
    priorityFeeConfig: PriorityFeeConfig,
    addressLookupTable?: AddressLookupTableAccount,
  ): Promise<{ tx: VersionedTransaction; signers: Signer[] }[]> {
    const transactionBuilder = new TransactionBuilder(
      payer,
      connection,
      addressLookupTable,
    );
    transactionBuilder.addInstructions(instructions);
    return transactionBuilder.buildVersionedTransactions(priorityFeeConfig);
  }

  /**
   * Add a priority fee to a legacy transaction
   */
  static addPriorityFee(
    transaction: Transaction,
    priorityFeeConfig: PriorityFeeConfig,
  ) {
    if (priorityFeeConfig.computeUnitPriceMicroLamports) {
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFeeConfig.computeUnitPriceMicroLamports,
        }),
      );
    }
  }
}

export const isVersionedTransaction = (
  tx: Transaction | VersionedTransaction,
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
  wallet: AnchorWallet,
  maxRetries?: number,
): Promise<string[]> {
  const blockhashResult = await connection.getLatestBlockhashAndContext({
    commitment: "confirmed",
  });

  const signatures: string[] = [];

  // Signing logic for versioned transactions is different from legacy transactions
  for (const [index, transaction] of transactions.entries()) {
    const signers = transaction.signers;
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
    let confirmedTx: SignatureResult | null = null;
    let retryCount = 0;

    // Get the signature of the transaction with different logic for versioned transactions
    const txSignature = bs58.encode(
      isVersionedTransaction(tx)
        ? tx.signatures?.[0] || new Uint8Array()
        : (tx.signature ?? new Uint8Array()),
    );

    const confirmTransactionPromise = connection.confirmTransaction(
      {
        signature: txSignature,
        blockhash: blockhashResult.value.blockhash,
        lastValidBlockHeight: blockhashResult.value.lastValidBlockHeight,
      },
      "confirmed",
    );

    confirmedTx = null;
    while (!confirmedTx) {
      confirmedTx = await Promise.race([
        new Promise<SignatureResult>((resolve) => {
          confirmTransactionPromise.then((result) => {
            resolve(result.value);
          });
        }),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            resolve(null);
          }, TX_RETRY_INTERVAL),
        ),
      ]);
      if (confirmedTx) {
        break;
      }
      if (maxRetries && maxRetries < retryCount) {
        break;
      }
      console.log(
        "Retrying transaction ",
        index,
        " of ",
        transactions.length - 1,
        " with signature: ",
        txSignature,
        " Retry count: ",
        retryCount,
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
      });
    }
    if (confirmedTx?.err) {
      throw new Error(
        `Transaction ${txSignature} has failed with error: ${JSON.stringify(
          confirmedTx.err,
        )}`,
      );
    }

    if (!confirmedTx) {
      throw new Error("Failed to land the transaction");
    }

    signatures.push(txSignature);
  }

  return signatures;
}
