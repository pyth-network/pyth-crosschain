import { PublicKey } from "@solana/web3.js";
import { FRACTION_PRECISION_N } from "../constants.js";
import type { PoolDataAccount, PublisherData } from "../types.js";
import {
  computeDelegatorRewardPercentage,
  convertEpochYieldToApy,
} from "./apy.js";

export const extractPublisherData = (
  poolData: PoolDataAccount,
): PublisherData => {
  return poolData.publishers
    .filter((publisher) => !publisher.equals(PublicKey.default))
    .map((publisher, index) => ({
      apyHistory: poolData.events
        .filter((event) => event.epoch > 0n)
        .map((event) => ({
          apy:
            convertEpochYieldToApy(
              (event.y * (event.eventData[index]?.otherRewardRatio ?? 0n)) /
                FRACTION_PRECISION_N,
            ) *
            computeDelegatorRewardPercentage(
              poolData.delegationFees[index] ?? 0n,
            ),
          epoch: event.epoch,
          selfApy: convertEpochYieldToApy(
            (event.y * (event.eventData[index]?.selfRewardRatio ?? 0n)) /
              FRACTION_PRECISION_N,
          ),
        }))
        .sort((a, b) => Number(a.epoch) - Number(b.epoch)),
      delegationFee: poolData.delegationFees[index] ?? 0n,
      pubkey: publisher,
      selfDelegation: poolData.selfDelState[index]?.totalDelegation ?? 0n,
      selfDelegationDelta: poolData.selfDelState[index]?.deltaDelegation ?? 0n,
      stakeAccount:
        poolData.publisherStakeAccounts[index] === undefined ||
        poolData.publisherStakeAccounts[index].equals(PublicKey.default)
          ? null // eslint-disable-line unicorn/no-null
          : poolData.publisherStakeAccounts[index],
      totalDelegation:
        (poolData.delState[index]?.totalDelegation ?? 0n) +
        (poolData.selfDelState[index]?.totalDelegation ?? 0n),
      totalDelegationDelta:
        (poolData.delState[index]?.deltaDelegation ?? 0n) +
        (poolData.selfDelState[index]?.deltaDelegation ?? 0n),
    }));
};
