import { readFileSync } from "node:fs";
import path from "node:path";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import { sliceAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import type { VersionedTransaction } from "@solana/web3.js-v3";

import {
  buildV1Transactions,
  compileV1Transaction,
  signV1Transaction,
} from "../transaction-v1.js";

// A Hermes response for 20 crypto price feeds, recorded on 2026-10-20 from https://hermes.pyth.network/v2/updates/price/latest
const { priceFeedIds: PRICE_FEED_IDS, priceUpdateData: PRICE_UPDATE_DATA } =
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "fixtures/hermes-price-update.json"),
      "utf8",
    ),
  ) as { priceFeedIds: string[]; priceUpdateData: string };

const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 50_000;
const RECENT_BLOCKHASH = "11111111111111111111111111111111";

const payer = Keypair.generate();
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
// Creating the encoded VAA account is the only instruction that reads the cluster.
jest
  .spyOn(connection, "getMinimumBalanceForRentExemption")
  .mockResolvedValue(10_000_000);
const pythSolanaReceiver = new PythSolanaReceiver({
  connection,
  wallet: new NodeWallet(payer),
});
const options = {
  computeUnitPriceMicroLamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
  payer,
  pythSolanaReceiver,
  shardId: 0,
};
const pushOracleProgramId = pythSolanaReceiver.pushOracle.programId.toBase58();

const accountAt = (tx: VersionedTransaction, index: number | undefined) => {
  const key =
    index === undefined ? undefined : tx.message.staticAccountKeys[index];
  if (key === undefined) {
    throw new Error(`No account at index ${String(index)}`);
  }
  return key.toBase58();
};

const instructionPrograms = (tx: VersionedTransaction) =>
  tx.message.compiledInstructions.map((ix) => accountAt(tx, ix.programIdIndex));

// The price feed account is the 6th account of `updatePriceFeed`.
const updatedPriceFeedAccounts = (tx: VersionedTransaction) =>
  tx.message.compiledInstructions
    .filter((ix) => accountAt(tx, ix.programIdIndex) === pushOracleProgramId)
    .map((ix) => accountAt(tx, ix.accountKeyIndexes[5]));

describe("v1 transactions", () => {
  it("packs all the price updates into self-contained v1 transactions", async () => {
    const transactions = await buildV1Transactions(
      options,
      [PRICE_UPDATE_DATA],
      RECENT_BLOCKHASH,
    );

    expect(transactions.length).toBeGreaterThan(1);
    const priceFeedAccounts: string[] = [];
    for (const { tx, signers } of transactions) {
      expect(tx.version).toBe(1);
      expect(tx.serialize().length).toBeLessThanOrEqual(4096);

      // Each transaction creates and closes its own encoded VAA account.
      expect(signers.map(({ publicKey }) => publicKey.toBase58())).toEqual([
        accountAt(tx, 1),
      ]);
      const programs = instructionPrograms(tx);
      expect(programs[0]).toBe(SystemProgram.programId.toBase58());
      expect(programs.at(-1)).toBe(
        pythSolanaReceiver.wormhole.programId.toBase58(),
      );
      expect(
        tx.message.compiledInstructions
          .at(-1)
          ?.accountKeyIndexes.map((index) => accountAt(tx, index)),
      ).toContain(accountAt(tx, 1));

      const computeUnitLimit =
        tx.message.transactionConfig?.computeUnitLimit ?? 0;
      expect(computeUnitLimit).toBeGreaterThan(0);
      expect(tx.message.transactionConfig?.priorityFeeLamports).toBe(
        BigInt(
          Math.ceil(
            (COMPUTE_UNIT_PRICE_MICRO_LAMPORTS * computeUnitLimit) / 1e6,
          ),
        ),
      );

      priceFeedAccounts.push(...updatedPriceFeedAccounts(tx));
    }

    expect(priceFeedAccounts.sort()).toEqual(
      PRICE_FEED_IDS.map((id) =>
        pythSolanaReceiver.getPriceFeedAccountAddress(0, id).toBase58(),
      ).sort(),
    );
  });

  it("puts the maximum number of price updates in each transaction", async () => {
    const transactions = await buildV1Transactions(
      options,
      [PRICE_UPDATE_DATA],
      RECENT_BLOCKHASH,
    );

    let start = 0;
    for (const { tx } of transactions.slice(0, -1)) {
      const numUpdates = updatedPriceFeedAccounts(tx).length;
      // One more price update does not fit.
      const { postInstructions, closeInstructions } =
        await pythSolanaReceiver.buildUpdatePriceFeedInstructions(
          [
            sliceAccumulatorUpdateData(
              Buffer.from(PRICE_UPDATE_DATA, "base64"),
              start,
              start + numUpdates + 1,
            ).toString("base64"),
          ],
          0,
        );
      expect(
        compileV1Transaction(
          options,
          [...postInstructions, ...closeInstructions],
          RECENT_BLOCKHASH,
        ),
      ).toBeUndefined();
      start += numUpdates;
    }
  });

  it("signs with the payer and the encoded VAA account", async () => {
    const [transaction] = await buildV1Transactions(
      options,
      [PRICE_UPDATE_DATA],
      RECENT_BLOCKHASH,
    );
    if (transaction === undefined) {
      throw new Error("No transaction");
    }
    const tx = await signV1Transaction(payer, transaction);

    expect(accountAt(tx, 0)).toBe(payer.publicKey.toBase58());
    expect(tx.signatures).toHaveLength(2);
    for (const signature of tx.signatures) {
      expect(signature.some((byte) => byte !== 0)).toBe(true);
    }
  });
});
