import "server-only";

import {
  PythStakingClient,
  epochToDate,
  extractPublisherData,
} from "@pythnetwork/staking-sdk";
import { Connection } from "@solana/web3.js";

import { cache } from "../cache";
import { SOLANA_RPC } from "../config/server";

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;

const connection = new Connection(SOLANA_RPC);
const client = new PythStakingClient({ connection });

export const getPublisherPoolData = cache(
  async () => {
    const poolData = await client.getPoolDataAccount();
    const publisherData = extractPublisherData(poolData);
    return publisherData.map(
      ({ totalDelegation, totalDelegationDelta, pubkey, apyHistory }) => ({
        totalDelegation,
        totalDelegationDelta,
        pubkey: pubkey.toBase58(),
        apyHistory: apyHistory.map(({ epoch, apy }) => ({
          date: epochToDate(epoch + 1n),
          apy,
        })),
      }),
    );
  },
  ["publisher-pool-data"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getDelState = cache(
  async () => {
    const poolData = await client.getPoolDataAccount();
    return {
      delState: poolData.delState,
      selfDelState: poolData.selfDelState,
    };
  },
  ["ois-del-state"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getClaimableRewards = cache(
  async () => {
    const poolData = await client.getPoolDataAccount();
    return poolData.claimableRewards;
  },
  ["ois-claimable-rewards"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);

export const getDistributedRewards = cache(
  async () => {
    const rewardCustodyAccount = await client.getRewardCustodyAccount();
    return rewardCustodyAccount.amount;
  },
  ["distributed-rewards"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);
