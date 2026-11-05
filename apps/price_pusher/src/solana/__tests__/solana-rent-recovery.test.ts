import type { HermesClient } from "@pythnetwork/hermes-client";
import type { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { Logger } from "pino";

import { SolanaPricePusher, SolanaPricePusherJito } from "../solana.js";

// The pusher imports sendTransactions/sendTransactionsJito directly, so the
// send must be intercepted at module level.
jest.mock("@pythnetwork/solana-utils", () => ({
  sendTransactions: jest.fn(),
  sendTransactionsJito: jest.fn(),
}));

// The jito path slices the accumulator blob per bundle; the pusher unit tests
// feed opaque base64 data, so slicing is identity here.
jest.mock("@pythnetwork/price-service-sdk", () => ({
  sliceAccumulatorUpdateData: (buf: Buffer): Buffer => buf,
}));

import {
  sendTransactions,
  sendTransactionsJito,
} from "@pythnetwork/solana-utils";

type FakeTx = { kind: "update" | "sweep" };

class FakeTransactionBuilder {
  isSweep = false;

  constructor(private readonly registry: FakeTransactionBuilder[]) {
    this.registry.push(this);
  }

  addUpdatePriceFeed(): Promise<void> {
    return Promise.resolve();
  }

  addClosePreviousEncodedVaasInstructions(): Promise<void> {
    this.isSweep = true;
    return Promise.resolve();
  }

  buildVersionedTransactions(): Promise<
    {
      signers: unknown[];
      tx: FakeTx;
    }[]
  > {
    return Promise.resolve([
      { signers: [], tx: { kind: this.isSweep ? "sweep" : "update" } },
    ]);
  }
}

// Minimal stand-in for PythSolanaReceiver: the pusher only uses
// newTransactionBuilder plus the connection/wallet handles passed to send.
const makeReceiver = () => {
  const builders: FakeTransactionBuilder[] = [];
  const receiver = {
    connection: {},
    newTransactionBuilder: (): FakeTransactionBuilder =>
      new FakeTransactionBuilder(builders),
    wallet: {},
  };
  return {
    builders,
    receiver: receiver as unknown as PythSolanaReceiver,
  };
};

const logger = {
  debug: () => {
    /* no-op */
  },
  error: () => {
    /* no-op */
  },
  warn: () => {
    /* no-op */
  },
} as unknown as Logger;

const hermesClient = {
  getLatestPriceUpdates: () => Promise.resolve({ binary: { data: ["Zm9v"] } }),
} as unknown as HermesClient;

beforeEach(() => {
  (sendTransactions as jest.Mock).mockReset();
  (sendTransactionsJito as jest.Mock).mockReset();
});

describe("SolanaPricePusher rent recovery after a failed batch", () => {
  it("sweeps orphaned encoded VAA accounts when the send fails", async () => {
    const { builders, receiver } = makeReceiver();
    // First send (the update batch) fails: any create instructions that had
    // already landed leave their accounts owned by the pusher wallet.
    (sendTransactions as jest.Mock)
      .mockRejectedValueOnce(new Error("Transaction expired"))
      .mockResolvedValue(["sweep-signature"]);

    const pusher = new SolanaPricePusher(receiver, hermesClient, logger, 0, 1);
    await pusher.updatePriceFeed(["abc"]);

    const sweepBuilders = builders.filter((b) => b.isSweep);
    expect(sweepBuilders).toHaveLength(1);

    expect(sendTransactions).toHaveBeenCalledTimes(2);
    const sweepArgs = (sendTransactions as jest.Mock).mock
      .calls[1][0] as FakeTx[];
    expect(sweepArgs[0].tx.kind).toBe("sweep");
  });

  it("does not sweep when the batch succeeds", async () => {
    const { builders, receiver } = makeReceiver();
    (sendTransactions as jest.Mock).mockResolvedValue(["sig"]);

    const pusher = new SolanaPricePusher(receiver, hermesClient, logger, 0, 1);
    await pusher.updatePriceFeed(["abc"]);

    expect(sendTransactions).toHaveBeenCalledTimes(1);
    expect(builders.filter((b) => b.isSweep)).toHaveLength(0);
  });

  it("does not let a failed sweep mask the original error path", async () => {
    const { receiver } = makeReceiver();
    (sendTransactions as jest.Mock)
      .mockRejectedValueOnce(new Error("Transaction expired"))
      .mockRejectedValueOnce(new Error("sweep send failed"));

    const pusher = new SolanaPricePusher(receiver, hermesClient, logger, 0, 1);
    await expect(pusher.updatePriceFeed(["abc"])).resolves.toBeUndefined();
  });
});

describe("SolanaPricePusherJito rent recovery after a failed bundle", () => {
  const makePusher = (receiver: PythSolanaReceiver) =>
    new SolanaPricePusherJito(
      receiver,
      hermesClient,
      logger,
      0,
      100_000,
      false,
      1_000_000,
      [],
      1,
      5000,
    );

  beforeEach(() => {
    // getRecentJitoTipLamports always probes the tip floor endpoint.
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("no network in tests"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sweeps orphaned accounts and still surfaces the original failure", async () => {
    const { builders, receiver } = makeReceiver();
    (sendTransactionsJito as jest.Mock).mockRejectedValue(
      new Error("bundle failed"),
    );
    (sendTransactions as jest.Mock).mockResolvedValue(["sweep-signature"]);

    const pusher = makePusher(receiver);
    await expect(pusher.updatePriceFeed(["abc"])).rejects.toThrow(
      "bundle failed",
    );

    expect(builders.filter((b) => b.isSweep)).toHaveLength(1);
    const sweepArgs = (sendTransactions as jest.Mock).mock.calls[0][0] as [
      FakeTx,
    ];
    expect(sweepArgs[0].tx.kind).toBe("sweep");
  });
});
