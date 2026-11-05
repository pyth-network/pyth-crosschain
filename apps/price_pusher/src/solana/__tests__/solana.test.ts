/* biome-ignore-all lint/suspicious/noExplicitAny: test spies on private methods */
import { readFileSync } from "node:fs";
import path from "node:path";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import type { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Connection, Keypair } from "@solana/web3.js";
import type { Logger } from "pino";
import {
  closePreviousEncodedVaas,
  SolanaPricePusher,
  SolanaPricePusherJito,
} from "../solana.js";

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

function setupConnectionMocks() {
  jest
    .spyOn(connection, "getMinimumBalanceForRentExemption")
    .mockResolvedValue(10_000_000);
  jest.spyOn(connection, "getLatestBlockhash").mockResolvedValue({
    blockhash: RECENT_BLOCKHASH,
    lastValidBlockHeight: 0,
  });
  jest.spyOn(connection, "getLatestBlockhashAndContext").mockResolvedValue({
    context: { slot: 1 },
    value: {
      blockhash: RECENT_BLOCKHASH,
      lastValidBlockHeight: 100,
    },
  });
  jest.spyOn(connection, "confirmTransaction").mockResolvedValue({
    context: { slot: 1 },
    value: { err: null },
  });
  jest
    .spyOn(connection, "sendRawTransaction")
    .mockResolvedValue("mockTxSignature");
}

setupConnectionMocks();

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
  beforeEach(() => {
    setupConnectionMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
});

describe("closePreviousEncodedVaas (#4049)", () => {
  const dummyLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    setupConnectionMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns empty array when no encoded VAA accounts exist", async () => {
    jest
      .spyOn(pythSolanaReceiver, "findOwnedEncodedVaaAccounts")
      .mockResolvedValue([]);
    const sendRawSpy = jest.spyOn(connection, "sendRawTransaction");

    const signatures = await closePreviousEncodedVaas(
      pythSolanaReceiver,
      dummyLogger,
    );

    expect(signatures).toEqual([]);
    expect(sendRawSpy).not.toHaveBeenCalled();
  });

  it("builds and sends close transactions when encoded VAA accounts are found", async () => {
    const fakeAccount1 = Keypair.generate().publicKey;
    const fakeAccount2 = Keypair.generate().publicKey;
    jest
      .spyOn(pythSolanaReceiver, "findOwnedEncodedVaaAccounts")
      .mockResolvedValue([fakeAccount1, fakeAccount2]);

    const confirmSpy = jest.spyOn(connection, "confirmTransaction");

    const signatures = await closePreviousEncodedVaas(
      pythSolanaReceiver,
      dummyLogger,
      { computeUnitPriceMicroLamports: 10_000, maxInstructions: 10 },
    );

    expect(signatures.length).toBeGreaterThanOrEqual(1);
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("handles errors gracefully without throwing", async () => {
    jest
      .spyOn(pythSolanaReceiver, "findOwnedEncodedVaaAccounts")
      .mockRejectedValue(new Error("RPC network timeout"));

    const signatures = await closePreviousEncodedVaas(
      pythSolanaReceiver,
      dummyLogger,
    );

    expect(signatures).toEqual([]);
  });
});

describe("SolanaPricePusher failure cleanup and periodic intervals (#4049)", () => {
  const dummyLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    setupConnectionMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("invokes closePreviousEncodedVaas after a failed v0 update", async () => {
    const mockHermes = {
      getLatestPriceUpdates: jest.fn().mockResolvedValue({
        binary: { data: [PRICE_UPDATE_DATA] },
      }),
    } as unknown as HermesClient;

    const pusher = new SolanaPricePusher(
      pythSolanaReceiver,
      mockHermes,
      dummyLogger,
      0,
      COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
      payer,
      "v0",
      undefined,
      0, // disable periodic cleanup during this test
    );

    jest
      .spyOn(pusher as any, "sendV0Transactions")
      .mockRejectedValue(new Error("Compute budget exceeded during update"));

    const closeSpy = jest
      .spyOn(pusher, "closePreviousEncodedVaas")
      .mockResolvedValue(["closeSig"]);

    await pusher.updatePriceFeed(["priceFeed1"]);

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not invoke closePreviousEncodedVaas after a failed v1 update", async () => {
    const mockHermes = {
      getLatestPriceUpdates: jest.fn().mockResolvedValue({
        binary: { data: [PRICE_UPDATE_DATA] },
      }),
    } as unknown as HermesClient;

    const pusher = new SolanaPricePusher(
      pythSolanaReceiver,
      mockHermes,
      dummyLogger,
      0,
      COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
      payer,
      "v1",
      undefined,
      0,
    );

    jest
      .spyOn(pusher as any, "sendV1Transactions")
      .mockRejectedValue(new Error("V1 update failed"));

    const closeSpy = jest
      .spyOn(pusher, "closePreviousEncodedVaas")
      .mockResolvedValue(["closeSig"]);

    await pusher.updatePriceFeed(["priceFeed1"]);

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("runs periodic cleanup when interval has elapsed", async () => {
    let currentTime = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => currentTime);

    const mockHermes = {
      getLatestPriceUpdates: jest.fn().mockResolvedValue({
        binary: { data: [PRICE_UPDATE_DATA] },
      }),
    } as unknown as HermesClient;

    const pusher = new SolanaPricePusher(
      pythSolanaReceiver,
      mockHermes,
      dummyLogger,
      0,
      COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
      payer,
      "v0",
      undefined,
      100, // 100ms interval
    );

    jest
      .spyOn(pusher as any, "sendV0Transactions")
      .mockResolvedValue(["mockTxSignature"]);

    const closeSpy = jest
      .spyOn(pusher, "closePreviousEncodedVaas")
      .mockResolvedValue(["closeSig"]);

    // First call triggers initial cleanup because lastCleanupTime = 0
    await pusher.updatePriceFeed(["priceFeed1"]);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // Immediate second call should not trigger periodic cleanup
    currentTime += 10;
    await pusher.updatePriceFeed(["priceFeed1"]);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // After interval has elapsed, periodic cleanup should trigger again
    currentTime += 200;
    await pusher.updatePriceFeed(["priceFeed1"]);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });
});

describe("SolanaPricePusherJito failure cleanup (#4049)", () => {
  const dummyLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    setupConnectionMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("invokes closePreviousEncodedVaas when Jito update fails", async () => {
    const mockHermes = {
      getLatestPriceUpdates: jest.fn().mockResolvedValue({
        binary: { data: [PRICE_UPDATE_DATA] },
      }),
    } as unknown as HermesClient;

    const jitoPusher = new SolanaPricePusherJito(
      pythSolanaReceiver,
      mockHermes,
      dummyLogger,
      0,
      1000,
      false,
      10_000,
      [],
      5,
      5000,
      undefined,
      0, // disable periodic cleanup
    );

    jest
      .spyOn(pythSolanaReceiver, "newTransactionBuilder")
      .mockImplementation(() => {
        throw new Error("Transaction build error");
      });

    const closeSpy = jest
      .spyOn(jitoPusher, "closePreviousEncodedVaas")
      .mockResolvedValue(["closeSig"]);

    await jitoPusher.updatePriceFeed(["priceFeed1"]);

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("runs periodic cleanup on Jito pusher when interval has elapsed", async () => {
    let currentTime = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => currentTime);

    const mockHermes = {
      getLatestPriceUpdates: jest.fn().mockResolvedValue({
        binary: { data: [] },
      }),
    } as unknown as HermesClient;

    const jitoPusher = new SolanaPricePusherJito(
      pythSolanaReceiver,
      mockHermes,
      dummyLogger,
      0,
      1000,
      false,
      10_000,
      [],
      5,
      5000,
      undefined,
      100, // 100ms interval
    );

    const closeSpy = jest
      .spyOn(jitoPusher, "closePreviousEncodedVaas")
      .mockResolvedValue(["closeSig"]);

    await jitoPusher.updatePriceFeed(["priceFeed1"]);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    currentTime += 10;
    await jitoPusher.updatePriceFeed(["priceFeed1"]);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    currentTime += 200;
    await jitoPusher.updatePriceFeed(["priceFeed1"]);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });
});
