"use client";

import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { useConnection } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import clsx from "clsx";
import type { HTMLProps } from "react";

import { StateType, useData } from "../../hooks/use-data";
import { Tokens } from "../Tokens";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;
const INITIAL_REWARD_POOL_SIZE = 60_000_000_000_000n;

export const Stats = ({ className, ...props }: HTMLProps<HTMLDivElement>) => {
  const { connection } = useConnection();
  const state = useData("poolStats", () => fetchStats(connection), {
    refreshInterval: REFRESH_INTERVAL,
  });

  return (
    <div className={clsx("flex flex-row items-stretch", className)} {...props}>
      <div className="flex-1 lg:flex-none">
        {state.type === StateType.Loaded ? (
          <Tokens className="mb-1 text-xl font-semibold leading-none">
            {state.data.totalStaked}
          </Tokens>
        ) : (
          <Loading />
        )}
        <div className="text-xs leading-none text-pythpurple-400">
          OIS Total Staked
        </div>
      </div>
      <div className="border-l border-neutral-600/50" />
      <div className="flex-1 lg:flex-none">
        {state.type === StateType.Loaded ? (
          <Tokens className="mb-1 text-xl font-semibold leading-none">
            {state.data.rewardsDistributed}
          </Tokens>
        ) : (
          <Loading />
        )}
        <div className="text-xs leading-none text-pythpurple-400">
          OIS Rewards Distributed
        </div>
      </div>
      <div className="border-l border-neutral-600/50" />
      <div className="flex-1 lg:flex-none">
        {state.type === StateType.Loaded ? (
          <Tokens className="mb-1 text-xl font-semibold leading-none">
            {state.data.totalGovernance}
          </Tokens>
        ) : (
          <Loading />
        )}
        <div className="text-xs leading-none text-pythpurple-400">
          Governance Total Staked
        </div>
      </div>
    </div>
  );
};

const Loading = () => (
  <div className="inline-block h-[1em] w-10 animate-pulse rounded-md bg-white/30" />
);

const fetchStats = async (connection: Connection) => {
  const client = new PythStakingClient({ connection });
  const [targetAccount, poolData, rewardCustodyAccount] = await Promise.all([
    client.getTargetAccount(),
    client.getPoolDataAccount(),
    client.getRewardCustodyAccount(),
  ]);

  return {
    totalGovernance: targetAccount.locked + targetAccount.deltaLocked,
    totalStaked:
      sumDelegations(poolData.delState) + sumDelegations(poolData.selfDelState),
    rewardsDistributed:
      poolData.claimableRewards +
      INITIAL_REWARD_POOL_SIZE -
      rewardCustodyAccount.amount,
  };
};

const sumDelegations = (
  values: { totalDelegation: bigint; deltaDelegation: bigint }[],
) =>
  values.reduce(
    (acc, value) => acc + value.totalDelegation + value.deltaDelegation,
    0n,
  );
