import { readFileSync } from "node:fs";
import path from "node:path";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import type { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair } from "@solana/web3.js";
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
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
} as unknown as Logger;

const v0Pusher = new SolanaPricePusher(
  pythSolanaReceiver,
  {} as HermesClient,
  mockLogger,
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

  it("handles reclaimOrphanedVaas safely without throwing on empty queue (#4049)", async () => {
    // When no orphaned accounts exist, returns empty array without throwing
    jest
      .spyOn(pythSolanaReceiver, "buildClosePreviousEncodedVaasInstructions")
      .mockResolvedValue([]);

    const result = await v0Pusher.reclaimOrphanedVaas(10);
    expect(result).toEqual([]);
  });

  it("triggers asynchronous reclamation on v0 transaction failure without blocking hot path (#4049)", async () => {
    const reclaimSpy = jest
      .spyOn(v0Pusher, "reclaimOrphanedVaas")
      .mockResolvedValue(["mock_sig_123"]);

    const hermesMock = {
      getLatestPriceUpdates: jest.fn().mockResolvedValue({
        binary: { data: [PRICE_UPDATE_DATA] },
      }),
    } as unknown as HermesClient;

    const failingPusher = new SolanaPricePusher(
      pythSolanaReceiver,
      hermesMock,
      mockLogger,
      0,
      COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
      payer,
    );

    // Mock sendV0Transactions to fail (simulating CU budget exhaustion)
    jest
      .spyOn(failingPusher as any, "sendV0Transactions")
      .mockRejectedValue(new Error("ComputationalBudgetExceeded"));

    const reclaimOrphanSpy = jest
      .spyOn(failingPusher, "reclaimOrphanedVaas")
      .mockResolvedValue(["reclaimed_sig"]);

    await failingPusher.updatePriceFeed(["price_id_1"]);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(reclaimOrphanSpy).toHaveBeenCalled();
  });
});
