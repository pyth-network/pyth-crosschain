import type { HermesClient } from "@pythnetwork/hermes-client";
import type { PythStakingClient } from "@pythnetwork/staking-sdk";
import { extractPublisherData, getCurrentEpoch } from "@pythnetwork/staking-sdk";
import { PublicKey } from "@solana/web3.js";

import { loadData } from "./api";

jest.mock("@pythnetwork/staking-sdk", () => ({
  ...jest.requireActual("@pythnetwork/staking-sdk"),
  extractPublisherData: jest.fn(),
  getCurrentEpoch: jest.fn(),
}));

const PUBLISHER = new PublicKey("11111111111111111111111111111111");

const makeStakingClient = () =>
  ({
    connection: {},
    getOwnerPythBalance: jest.fn().mockResolvedValue(5n),
    getPoolConfigAccount: jest.fn().mockResolvedValue({ y: 7n }),
    getPoolDataAccount: jest.fn().mockResolvedValue({}),
  }) as unknown as PythStakingClient;

const makeHermesClient = (
  getLatestPublisherCaps: jest.Mock,
): HermesClient => ({ getLatestPublisherCaps }) as unknown as HermesClient;

describe("loadData publisher caps", () => {
  beforeEach(() => {
    jest.mocked(getCurrentEpoch).mockResolvedValue(3n);
    jest.mocked(extractPublisherData).mockReturnValue([
      {
        apyHistory: [],
        delegationFee: 0n,
        pubkey: PUBLISHER,
        selfDelegation: 0n,
        selfDelegationDelta: 0n,
        totalDelegation: 0n,
        totalDelegationDelta: 0n,
      },
    ] as unknown as ReturnType<typeof extractPublisherData>);
  });

  it("uses the caps returned by hermes", async () => {
    const caps = jest.fn().mockResolvedValue({
      parsed: [
        { publisher_stake_caps: [{ cap: 42, publisher: PUBLISHER.toBase58() }] },
      ],
    });
    const data = await loadData(makeStakingClient(), makeHermesClient(caps));
    expect(data.integrityStakingPublishers[0]?.poolCapacity).toBe(42n);
  });

  it("still loads the page with zero caps if the caps request fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {
      /* silence expected warning */
    });
    const caps = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const data = await loadData(makeStakingClient(), makeHermesClient(caps));
    expect(data.integrityStakingPublishers).toHaveLength(1);
    expect(data.integrityStakingPublishers[0]?.poolCapacity).toBe(0n);
    expect(data.yieldRate).toBe(7n);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
