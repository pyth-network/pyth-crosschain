import { readFileSync } from "node:fs";
import path from "node:path";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import type { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { Logger } from "pino";

import { SolanaPricePusher } from "../solana.js";

// A Hermes response for 20 crypto price feeds, recorded on 2026-10-20 from https://hermes.pyth.network/v2/updates/price/latest
const { priceUpdateData: PRICE_UPDATE_DATA } = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "fixtures/hermes-price-update.json"),
    "utf8",
  ),
) as { priceUpdateData: string };

const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 50_000;
const RECENT_BLOCKHASH = "11111111111111111111111111111111";

const payer = Keypair.generate();
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
jest
  .spyOn(connection, "getMinimumBalanceForRentExemption")
  .mockResolvedValue(10_000_000);
jest.spyOn(connection, "getLatestBlockhash").mockResolvedValue({
  blockhash: RECENT_BLOCKHASH,
  lastValidBlockHeight: 0,
});
const pythSolanaReceiver = new PythSolanaReceiver({
  connection,
  wallet: new NodeWallet(payer),
});
const v0Pusher = new SolanaPricePusher(
  pythSolanaReceiver,
  {} as HermesClient,
  {} as Logger,
  0,
  COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
  payer,
);

describe("SolanaPricePusher v0 transactions", () => {
  it("builds v0 transactions by default", async () => {
    const transactions = await v0Pusher.buildV0Transactions([
      PRICE_UPDATE_DATA,
    ]);

    expect(transactions.length).toBeGreaterThan(1);
    for (const { tx } of transactions) {
      expect(tx.version).toBe(0);
      expect(tx.serialize().length).toBeLessThanOrEqual(1232);
    }
  });

  it("enqueues and drains unclosed VAA accounts on transaction failure (#4049)", async () => {
    const fakeVaaAccount = Keypair.generate().publicKey;

    // Simulate failed transaction enqueuing unclosed account
    v0Pusher.enqueueLeakedVaaAccount(fakeVaaAccount);
    expect(v0Pusher.getPendingReclamationCount()).toBe(1);

    // Build reclamation transactions without blocking price update hot path
    const reclaimTxs = await v0Pusher.buildReclamationTransactions(5);
    expect(reclaimTxs.length).toBe(1);
    expect(reclaimTxs[0].tx.serialize().length).toBeLessThanOrEqual(1232);

    // Assert queue is drained
    expect(v0Pusher.getPendingReclamationCount()).toBe(0);
  });
});
