import type { Logger } from "pino";

import type { CustomGasStation } from "../custom-gas-station.js";
import type { GasPrice } from "../gas-price.js";
import {
  describeGasPrice,
  gasPriceToTxParams,
  getGasPrice,
  maxGasPrice,
  minGasPrice,
  scaleGasPrice,
} from "../gas-price.js";
import type { SuperWalletClient } from "../super-wallet.js";

const logger = {
  debug: () => {
    /* no-op */
  },
} as unknown as Logger;

// Build a minimal client stub exposing only the methods getGasPrice uses.
const makeClient = (overrides: Record<string, unknown>): SuperWalletClient =>
  overrides as unknown as SuperWalletClient;

describe("getGasPrice (legacy strategy)", () => {
  const baseConfig = {
    baseFeeMultiplier: 1.2,
    priorityFeeMultiplier: 1,
    strategy: "legacy" as const,
  };

  it("uses the explicit gasPrice override when provided", async () => {
    const client = makeClient({
      getGasPrice: () => Promise.resolve(999n),
    });

    const result = await getGasPrice(
      client,
      { ...baseConfig, gasPrice: 1234 },
      logger,
    );

    expect(result).toStrictEqual({ gasPrice: 1234n, strategy: "legacy" });
  });

  it("prefers the custom gas station over the RPC gas price", async () => {
    const client = makeClient({
      getGasPrice: () => Promise.resolve(999n),
    });
    const customGasStation = {
      getCustomGasPrice: () => Promise.resolve(500n),
    } as unknown as CustomGasStation;

    const result = await getGasPrice(
      client,
      { ...baseConfig, customGasStation },
      logger,
    );

    expect(result).toStrictEqual({ gasPrice: 500n, strategy: "legacy" });
  });

  it("falls back to the RPC gas price", async () => {
    const client = makeClient({
      getGasPrice: () => Promise.resolve(777n),
    });

    const result = await getGasPrice(client, baseConfig, logger);

    expect(result).toStrictEqual({ gasPrice: 777n, strategy: "legacy" });
  });
});

describe("getGasPrice (eip1559 strategy)", () => {
  it("computes maxFeePerGas from the padded base fee plus the scaled priority fee", async () => {
    const client = makeClient({
      estimateMaxPriorityFeePerGas: () => Promise.resolve(10n),
      getBlock: () => Promise.resolve({ baseFeePerGas: 100n }),
    });

    const result = await getGasPrice(
      client,
      {
        baseFeeMultiplier: 1.5,
        priorityFeeMultiplier: 2,
        strategy: "eip1559",
      },
      logger,
    );

    // priorityFee = 10 * 2 = 20; maxFee = 100 * 1.5 + 20 = 170
    expect(result).toStrictEqual({
      maxFeePerGas: 170n,
      maxPriorityFeePerGas: 20n,
      strategy: "eip1559",
    });
  });

  it("throws a clear error when the chain has no base fee", async () => {
    const client = makeClient({
      estimateMaxPriorityFeePerGas: () => Promise.resolve(10n),
      // eslint-disable-next-line unicorn/no-null
      getBlock: () => Promise.resolve({ baseFeePerGas: null }),
    });

    await expect(
      getGasPrice(
        client,
        {
          baseFeeMultiplier: 1.2,
          priorityFeeMultiplier: 1,
          strategy: "eip1559",
        },
        logger,
      ),
    ).rejects.toThrow(/legacy/);
  });
});

describe("scaleGasPrice", () => {
  it("scales the single fee in legacy mode", () => {
    const scaled = scaleGasPrice({ gasPrice: 100n, strategy: "legacy" }, 1.1);
    expect(scaled).toStrictEqual({ gasPrice: 110n, strategy: "legacy" });
  });

  it("scales both fee components in eip1559 mode", () => {
    const scaled = scaleGasPrice(
      { maxFeePerGas: 200n, maxPriorityFeePerGas: 20n, strategy: "eip1559" },
      1.5,
    );
    expect(scaled).toStrictEqual({
      maxFeePerGas: 300n,
      maxPriorityFeePerGas: 30n,
      strategy: "eip1559",
    });
  });
});

describe("maxGasPrice / minGasPrice", () => {
  const low: GasPrice = { gasPrice: 100n, strategy: "legacy" };
  const high: GasPrice = { gasPrice: 200n, strategy: "legacy" };

  it("max picks the higher bid", () => {
    expect(maxGasPrice(low, high)).toBe(high);
  });

  it("min picks the lower bid", () => {
    expect(minGasPrice(low, high)).toBe(low);
  });

  it("compares eip1559 prices by maxFeePerGas", () => {
    const a: GasPrice = {
      maxFeePerGas: 300n,
      maxPriorityFeePerGas: 5n,
      strategy: "eip1559",
    };
    const b: GasPrice = {
      maxFeePerGas: 250n,
      maxPriorityFeePerGas: 50n,
      strategy: "eip1559",
    };
    expect(maxGasPrice(a, b)).toBe(a);
    expect(minGasPrice(a, b)).toBe(b);
  });
});

describe("override + cap composition (as used by the pusher)", () => {
  // Mirrors the escalation logic in evm.ts: bump the last attempt by the
  // override multiplier, but cap it relative to the fresh gas price.
  const escalate = (
    fresh: GasPrice,
    lastAttempt: GasPrice,
    multiplier: number,
    cap: number,
  ): GasPrice =>
    minGasPrice(
      maxGasPrice(scaleGasPrice(lastAttempt, multiplier), fresh),
      scaleGasPrice(fresh, cap),
    );

  it("keeps the fresh price when the override is not higher", () => {
    const fresh: GasPrice = { gasPrice: 200n, strategy: "legacy" };
    const lastAttempt: GasPrice = { gasPrice: 100n, strategy: "legacy" };
    // override = 100 * 1.1 = 110 < 200 -> keep fresh
    expect(escalate(fresh, lastAttempt, 1.1, 5)).toStrictEqual(fresh);
  });

  it("bumps to the escalated override when it exceeds the fresh price", () => {
    const fresh: GasPrice = { gasPrice: 100n, strategy: "legacy" };
    const lastAttempt: GasPrice = { gasPrice: 200n, strategy: "legacy" };
    // override = 200 * 1.1 = 220; cap = 100 * 5 = 500 -> 220
    expect(escalate(fresh, lastAttempt, 1.1, 5)).toStrictEqual({
      gasPrice: 220n,
      strategy: "legacy",
    });
  });

  it("caps the override at fresh * cap", () => {
    const fresh: GasPrice = { gasPrice: 100n, strategy: "legacy" };
    const lastAttempt: GasPrice = { gasPrice: 1000n, strategy: "legacy" };
    // override = 1000 * 2 = 2000; cap = 100 * 3 = 300 -> 300
    expect(escalate(fresh, lastAttempt, 2, 3)).toStrictEqual({
      gasPrice: 300n,
      strategy: "legacy",
    });
  });
});

describe("gasPriceToTxParams", () => {
  it("emits gasPrice for legacy", () => {
    expect(
      gasPriceToTxParams({ gasPrice: 100n, strategy: "legacy" }),
    ).toStrictEqual({ gasPrice: 100n });
  });

  it("emits maxFeePerGas and maxPriorityFeePerGas for eip1559", () => {
    expect(
      gasPriceToTxParams({
        maxFeePerGas: 200n,
        maxPriorityFeePerGas: 20n,
        strategy: "eip1559",
      }),
    ).toStrictEqual({ maxFeePerGas: 200n, maxPriorityFeePerGas: 20n });
  });
});

describe("describeGasPrice", () => {
  it("describes legacy and eip1559 prices", () => {
    expect(describeGasPrice({ gasPrice: 100n, strategy: "legacy" })).toBe(
      "gasPrice=100",
    );
    expect(
      describeGasPrice({
        maxFeePerGas: 200n,
        maxPriorityFeePerGas: 20n,
        strategy: "eip1559",
      }),
    ).toBe("maxFeePerGas=200 maxPriorityFeePerGas=20");
  });
});
