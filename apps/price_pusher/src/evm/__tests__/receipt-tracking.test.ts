import type { HermesClient, UnixTimestamp } from "@pythnetwork/hermes-client";
import type { Logger } from "pino";

import { EvmPricePusher } from "../evm.js";
import type { GasPriceConfig } from "../gas-price.js";
import type { PythContract } from "../pyth-contract.js";
import type { SuperWalletClient } from "../super-wallet.js";

type Hash = `0x${string}`;

// A receipt is absent (viem throws TransactionReceiptNotFoundError while a tx is
// unmined — modelled here as a throw) or a landed receipt.
type ReceiptPolicy = "pending" | "success" | "reverted";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Instrumented mock of the pieces EvmPricePusher.updatePriceFeed touches. It
// counts RPC calls per method (and, crucially, per tx hash for receipt lookups)
// and lets each scenario drive the on-chain nonce and per-hash receipt state.
class MockChain {
  calls = {
    getTransactionByHash: 0,
    getTransactionCount: 0,
    getTransactionReceipt: 0,
    waitForTransactionReceipt: 0,
    writeContract: 0,
  };
  receiptCallsByHash = new Map<string, number>();
  policyByHash = new Map<string, ReceiptPolicy>();
  defaultPolicy: ReceiptPolicy = "pending";
  // On-chain mined-tx count returned by getTransactionCount (the nonce source).
  minedTxCount = 5;
  sentHashes: Hash[] = [];
  private hashCounter = 0;

  private nextHash(): Hash {
    this.hashCounter += 1;
    return `0x${this.hashCounter.toString(16).padStart(64, "0")}` as Hash;
  }

  get client(): SuperWalletClient {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      account: { address: "0x1111111111111111111111111111111111111111" },
      estimateMaxPriorityFeePerGas: () => Promise.resolve(1_000_000_000n),
      getBlock: () => Promise.resolve({ baseFeePerGas: 1_000_000_000n }),
      // Leak-prone methods the OLD code used. They MUST never be called now.
      getTransaction: () => {
        self.calls.getTransactionByHash += 1;
        return Promise.reject(
          new Error("eth_getTransactionByHash must not be called"),
        );
      },
      getTransactionCount: () => {
        self.calls.getTransactionCount += 1;
        return Promise.resolve(self.minedTxCount);
      },
      // The ONLY method the receipt tracker should call.
      getTransactionReceipt: ({ hash }: { hash: Hash }) => {
        self.calls.getTransactionReceipt += 1;
        self.receiptCallsByHash.set(
          hash,
          (self.receiptCallsByHash.get(hash) ?? 0) + 1,
        );
        const policy = self.policyByHash.get(hash) ?? self.defaultPolicy;
        if (policy === "pending") {
          // viem throws while the tx is not yet mined.
          return Promise.reject(new Error("TransactionReceiptNotFoundError"));
        }
        return Promise.resolve({ status: policy, transactionHash: hash });
      },
      waitForTransactionReceipt: () => {
        self.calls.waitForTransactionReceipt += 1;
        return Promise.reject(
          new Error("client.waitForTransactionReceipt must not be called"),
        );
      },
      writeContract: () => {
        self.calls.writeContract += 1;
        const hash = self.nextHash();
        self.sentHashes.push(hash);
        if (!self.policyByHash.has(hash)) {
          self.policyByHash.set(hash, self.defaultPolicy);
        }
        return Promise.resolve(hash);
      },
    } as unknown as SuperWalletClient;
  }

  get pythContract(): PythContract {
    return {
      read: { getUpdateFee: () => Promise.resolve(1n) },
      simulate: {
        updatePriceFeedsIfNecessary: () => Promise.resolve({ request: {} }),
      },
    } as unknown as PythContract;
  }
}

const hermesClient = {
  getLatestPriceUpdates: () => Promise.resolve({ binary: { data: ["abcd"] } }),
} as unknown as HermesClient;

const gasPriceConfig: GasPriceConfig = {
  baseFeeMultiplier: 1.2,
  priorityFeeMultiplier: 1,
  strategy: "eip1559",
};

type LogEntry = { hash?: Hash; msg?: string };

const makeLogger = (): {
  logger: Logger;
  logs: { info: LogEntry[]; debug: LogEntry[]; warn: LogEntry[] };
} => {
  const logs = {
    debug: [] as LogEntry[],
    info: [] as LogEntry[],
    warn: [] as LogEntry[],
  };
  // The success line shares the debug channel with several other hash-bearing
  // messages ("Price update sent", the gave-up-at-deadline line), so the
  // message has to be captured to tell them apart.
  const record = (arr: LogEntry[]) => (obj: unknown, msg?: unknown) => {
    if (typeof obj === "string") {
      arr.push({ msg: obj });
      return;
    }
    arr.push({
      ...((obj ?? {}) as { hash?: Hash }),
      msg: typeof msg === "string" ? msg : undefined,
    });
  };
  const logger = {
    debug: record(logs.debug),
    error: record(logs.debug),
    info: record(logs.info),
    warn: record(logs.warn),
  } as unknown as Logger;
  return { logger, logs };
};

const makePusher = (
  chain: MockChain,
  logger: Logger,
  timeoutMs: number,
  intervalMs: number,
): EvmPricePusher =>
  new EvmPricePusher(
    hermesClient,
    chain.client,
    chain.pythContract,
    logger,
    1.1, // overrideGasPriceMultiplier
    5, // overrideGasPriceMultiplierCap
    1, // updateFeeMultiplier
    gasPriceConfig,
    undefined, // gasLimit
    timeoutMs, // receiptWaitTimeoutMs
    intervalMs, // receiptPollIntervalMs
  );

const PRICE_IDS = [
  "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
];
const PUB_TIMES: UnixTimestamp[] = [1000];
// Emitted by evm.ts once per landed, successful tx. Kept at debug level.
const SUCCESS_MSG = "Price update successful";
const successLogs = (entries: LogEntry[]): LogEntry[] =>
  entries.filter((entry) => entry.msg === SUCCESS_MSG && entry.hash !== undefined);

describe("EvmPricePusher receipt tracking (leak fix)", () => {
  it("happy path: logs success once, polls only getTransactionReceipt, never getTransactionByHash", async () => {
    const chain = new MockChain();
    chain.defaultPolicy = "success"; // lands on first poll
    const { logger, logs } = makeLogger();
    const pusher = makePusher(chain, logger, 500, 20);

    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(120);

    const landed = successLogs(logs.debug).filter(
      (entry) =>
        entry.hash !== undefined && chain.sentHashes.includes(entry.hash),
    );
    expect(landed).toHaveLength(1);
    expect(chain.calls.getTransactionByHash).toBe(0);
    expect(chain.calls.waitForTransactionReceipt).toBe(0);
    expect(chain.calls.getTransactionReceipt).toBeLessThanOrEqual(2);
  });

  it("never-lands: the receipt poll is BOUNDED and stops (no leak)", async () => {
    const chain = new MockChain();
    chain.defaultPolicy = "pending"; // never lands
    const { logger, logs } = makeLogger();
    const timeoutMs = 200;
    const intervalMs = 40;
    const pusher = makePusher(chain, logger, timeoutMs, intervalMs);

    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(timeoutMs + 150);

    const bound = Math.ceil(timeoutMs / intervalMs) + 2;
    // It must actually have polled (not a dead tracker) AND stayed bounded.
    expect(chain.calls.getTransactionReceipt).toBeGreaterThan(1);
    expect(chain.calls.getTransactionReceipt).toBeLessThanOrEqual(bound);
    const countAtDeadline = chain.calls.getTransactionReceipt;

    // After the deadline, polling must have fully stopped.
    await sleep(200);
    expect(chain.calls.getTransactionReceipt).toBe(countAtDeadline);
    expect(successLogs(logs.debug)).toHaveLength(0);
    expect(chain.calls.getTransactionByHash).toBe(0);
  });

  it("same-nonce escalation: both hashes stay watched; the OLD tx winning the race is still logged (Codex)", async () => {
    // On a same-nonce gas escalation the original and repriced tx compete for
    // the nonce, and a miner may include the OLD one over the replacement. The
    // original's tracker must NOT be cancelled, or its landing is never logged
    // and the Grafana Tx-Hash panel misses a tx that actually landed.
    const chain = new MockChain();
    chain.defaultPolicy = "pending"; // both pending -> same-nonce escalation path
    const { logger, logs } = makeLogger();
    const pusher = makePusher(chain, logger, 10_000, 30);

    // Push A (nonce 5), then push B — same nonce (A not landed), escalated gas.
    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(60);
    const hashA = chain.sentHashes[0] as Hash;
    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(60);
    const hashB = chain.sentHashes[1] as Hash;
    expect(hashB).not.toEqual(hashA);

    // Both are still polled after the escalation — A was NOT cancelled.
    const aBefore = chain.receiptCallsByHash.get(hashA) ?? 0;
    await sleep(90);
    expect(
      (chain.receiptCallsByHash.get(hashA) ?? 0) - aBefore,
    ).toBeGreaterThan(0);
    expect(chain.receiptCallsByHash.get(hashB) ?? 0).toBeGreaterThan(0);

    // The OLD tx wins the mempool race and lands after being superseded.
    chain.policyByHash.set(hashA, "success");
    await sleep(90);

    const successHashes = successLogs(logs.debug).map((entry) => entry.hash);
    expect(successHashes).toContain(hashA); // A's landing IS logged
    expect(successHashes).not.toContain(hashB); // B never lands
    expect(successLogs(logs.debug)).toHaveLength(1);

    pusher.dispose();
    await sleep(20);
  });

  it("nonce advance: the resolved nonce's stragglers are aborted (bounded) but its landed tx is still logged", async () => {
    const chain = new MockChain();
    chain.defaultPolicy = "pending";
    const { logger, logs } = makeLogger();
    const pusher = makePusher(chain, logger, 10_000, 30);

    // Push A (nonce 5), pending.
    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(60);
    const hashA = chain.sentHashes[0] as Hash;

    // A lands and the on-chain nonce advances; the next push uses nonce 6, a
    // DIFFERENT nonce, which aborts A's straggler while still logging A.
    chain.policyByHash.set(hashA, "success");
    chain.minedTxCount = 6;
    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(90);

    // A's landing is logged via the final lookup on abort.
    const successHashes = successLogs(logs.debug).map((entry) => entry.hash);
    expect(successHashes).toContain(hashA);

    // A is then aborted -> no longer polled (bounded across the nonce boundary).
    const aAfter = chain.receiptCallsByHash.get(hashA) ?? 0;
    await sleep(120);
    expect(chain.receiptCallsByHash.get(hashA) ?? 0).toBe(aAfter);

    pusher.dispose();
    await sleep(20);
  });

  it("reverted tx: no success log, tracker stops", async () => {
    const chain = new MockChain();
    chain.defaultPolicy = "reverted";
    const { logger, logs } = makeLogger();
    const pusher = makePusher(chain, logger, 500, 20);

    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    await sleep(120);

    expect(successLogs(logs.debug)).toHaveLength(0);
    expect(chain.calls.getTransactionReceipt).toBeLessThanOrEqual(2);
    expect(chain.calls.getTransactionByHash).toBe(0);
  });

  it("pushes stop: the last un-landing tracker self-terminates at the deadline", async () => {
    const chain = new MockChain();
    chain.defaultPolicy = "pending";
    const { logger } = makeLogger();
    const timeoutMs = 150;
    const pusher = makePusher(chain, logger, timeoutMs, 30);

    await pusher.updatePriceFeed(PRICE_IDS, PUB_TIMES);
    // Controller goes idle (no more pushes). The tracker must not poll forever.
    await sleep(timeoutMs + 200);
    const finalCount = chain.calls.getTransactionReceipt;
    await sleep(200);
    expect(chain.calls.getTransactionReceipt).toBe(finalCount);
  });
});
