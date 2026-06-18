import "server-only";

import {
  epochToDate,
  extractPublisherData,
  PythStakingClient,
} from "@pythnetwork/staking-sdk";
import { Connection } from "@solana/web3.js";

import { SOLANA_RPC } from "../config/server";

const connection = new Connection(SOLANA_RPC);
const client = new PythStakingClient({ connection });

export const getPublisherPoolData = async () => {
  const poolData = await client.getPoolDataAccount();
  const publisherData = extractPublisherData(poolData);
  return publisherData.map(
    ({ totalDelegation, totalDelegationDelta, pubkey, apyHistory }) => ({
      apyHistory: apyHistory.map(({ epoch, apy }) => ({
        apy,
        date: epochToDate(epoch + 1n),
      })),
      pubkey: pubkey.toBase58(),
      totalDelegation,
      totalDelegationDelta,
    }),
  );
};

export const getDelState = async () => {
  const poolData = await client.getPoolDataAccount();
  return {
    delState: poolData.delState,
    selfDelState: poolData.selfDelState,
  };
};

export const getClaimableRewards = async () => {
  const poolData = await client.getPoolDataAccount();
  return poolData.claimableRewards;
};

export const getDistributedRewards = async () => {
  const rewardCustodyAccount = await client.getRewardCustodyAccount();
  return rewardCustodyAccount.amount;
};
