import {
  parseAccumulatorUpdateData,
  sliceAccumulatorUpdateData,
} from "@pythnetwork/price-service-sdk";
import type { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { InstructionWithEphemeralSigners } from "@pythnetwork/solana-utils";
import { sendAndConfirmSerializedTransaction } from "@pythnetwork/solana-utils";
import type {
  Connection,
  Keypair,
  Signer,
  TransactionInstruction,
} from "@solana/web3.js";
// web3.js 1.x can read v1 transactions but not build them, so v1 transactions are built with web3.js 3.x.
// The Anchor programs in `PythSolanaReceiver` still produce web3.js 1.x instructions.
import * as web3V3 from "@solana/web3.js-v3";
import bs58 from "bs58";
import type { Logger } from "pino";

/**
 * The maximum size of a serialized v1 transaction (SIMD-0385).
 */
export const V1_TRANSACTION_SIZE_LIMIT = 4096;

/**
 * The maximum number of compute units a transaction can request.
 */
export const MAX_COMPUTE_UNITS_PER_TRANSACTION = 1_400_000;

/**
 * The maximum size of the account data a transaction can load. A v1 transaction that does not set
 * `loadedAccountsDataSizeLimit` fails with `MaxLoadedAccountsDataSizeExceeded`, so the pusher sets it to the
 * maximum, which is the default for legacy and v0 transactions. The programs of a price update load about 3 MB.
 */
export const MAX_LOADED_ACCOUNTS_DATA_SIZE_BYTES = 64 * 1024 * 1024;

/**
 * The maximum number of accounts a transaction can lock.
 */
export const MAX_ACCOUNT_LOCKS_PER_TRANSACTION = 64;

/**
 * An unsigned v1 transaction, plus the ephemeral signers that must sign it with the payer.
 */
export type V1TransactionWithEphemeralSigners = {
  tx: web3V3.VersionedTransaction;
  signers: Signer[];
};

/**
 * What the v1 functions need to build, sign and send price update transactions.
 */
export type V1TransactionOptions = {
  pythSolanaReceiver: PythSolanaReceiver;
  payer: Keypair;
  shardId: number;
  computeUnitPriceMicroLamports: number;
};

/**
 * The web3.js 3.x copy of each payer. `web3V3.Keypair.fromSecretKey` is async, so each payer is converted once.
 */
const payersV3 = new WeakMap<Keypair, Promise<web3V3.Keypair>>();

export function toV3Instruction(
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

function getPayerV3(payer: Keypair): Promise<web3V3.Keypair> {
  let payerV3 = payersV3.get(payer);
  if (payerV3 === undefined) {
    payerV3 = web3V3.Keypair.fromSecretKey(payer.secretKey);
    payersV3.set(payer, payerV3);
  }
  return payerV3;
}

/**
 * Split the price updates into unsigned v1 transactions. Each transaction holds as many price updates as fit.
 *
 * @returns the transactions, and for each transaction the ephemeral signers that must sign it with the payer
 */
export async function buildV1Transactions(
  options: V1TransactionOptions,
  priceFeedUpdateData: string[],
  recentBlockhash: string,
): Promise<V1TransactionWithEphemeralSigners[]> {
  const { pythSolanaReceiver, shardId } = options;
  const transactions: V1TransactionWithEphemeralSigners[] = [];
  for (const updateData of priceFeedUpdateData) {
    const accumulatorUpdateData = Buffer.from(updateData, "base64");
    const numUpdates = parseAccumulatorUpdateData(accumulatorUpdateData).updates
      .length;

    let start = 0;
    while (start < numUpdates) {
      // Each transaction posts the VAA to a new encoded VAA account, so the instructions are built again for each transaction.
      const { postInstructions, closeInstructions } =
        await pythSolanaReceiver.buildUpdatePriceFeedInstructions(
          [
            sliceAccumulatorUpdateData(
              accumulatorUpdateData,
              start,
              numUpdates,
            ).toString("base64"),
          ],
          shardId,
        );
      const isUpdateInstruction = ({
        instruction,
      }: InstructionWithEphemeralSigners) =>
        instruction.programId.equals(pythSolanaReceiver.pushOracle.programId);
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
        const tx = compileV1Transaction(
          options,
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
export function compileV1Transaction(
  {
    payer,
    computeUnitPriceMicroLamports,
  }: Pick<V1TransactionOptions, "payer" | "computeUnitPriceMicroLamports">,
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
    payerKey: new web3V3.PublicKey(payer.publicKey.toBase58()),
    recentBlockhash: recentBlockhash as web3V3.Blockhash,
    // v1 transactions ignore compute budget instructions. The priority fee is the total fee in lamports.
    transactionConfig: {
      computeUnitLimit: computeUnits,
      loadedAccountsDataSizeLimit: MAX_LOADED_ACCOUNTS_DATA_SIZE_BYTES,
      priorityFeeLamports: BigInt(
        Math.ceil((computeUnitPriceMicroLamports * computeUnits) / 1e6),
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
export async function signV1Transaction(
  payer: Keypair,
  { tx, signers }: V1TransactionWithEphemeralSigners,
): Promise<web3V3.VersionedTransaction> {
  await tx.sign([
    await getPayerV3(payer),
    ...(await Promise.all(
      signers.map((signer) => web3V3.Keypair.fromSecretKey(signer.secretKey)),
    )),
  ]);
  return tx;
}

/**
 * Build, sign and send the v1 transactions for the price updates, one after the other.
 *
 * @returns the signatures of the transactions
 */
export async function sendV1Transactions(
  options: V1TransactionOptions,
  priceFeedUpdateData: string[],
  connection: Connection,
  logger: Logger,
): Promise<string[]> {
  const blockhash = await connection.getLatestBlockhash({
    commitment: "confirmed",
  });
  const transactions = await buildV1Transactions(
    options,
    priceFeedUpdateData,
    blockhash.blockhash,
  );

  const signatures: string[] = [];
  for (const transaction of transactions) {
    const tx = await signV1Transaction(options.payer, transaction);
    const [payerSignature] = tx.signatures;
    if (payerSignature === undefined) {
      throw new Error("The transaction has no payer signature");
    }
    const signature = bs58.encode(payerSignature);
    await sendAndConfirmSerializedTransaction(
      tx.serialize(),
      signature,
      blockhash,
      connection,
      undefined,
      logger,
    );
    signatures.push(signature);
  }
  return signatures;
}
