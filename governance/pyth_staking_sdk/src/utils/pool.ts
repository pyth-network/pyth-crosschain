import { PublicKey } from "@solana/web3.js";

import { convertEpochYieldToApy } from "./apy";
import { FRACTION_PRECISION_N } from "../constants";
import type { PoolDataAccount, PublisherData } from "../types";

export const extractPublisherData = (
  poolData: PoolDataAccount,
): PublisherData => {
  return poolData.publishers
    .filter((publisher) => !publisher.equals(PublicKey.default))
    .map((publisher, index) => ({
      pubkey: publisher,
      stakeAccount:
        poolData.publisherStakeAccounts[index] === undefined ||
        poolData.publisherStakeAccounts[index].equals(PublicKey.default)
          ? null
          : poolData.publisherStakeAccounts[index],
      totalDelegation:
        (poolData.delState[index]?.totalDelegation ?? 0n) +
        (poolData.selfDelState[index]?.totalDelegation ?? 0n),
      totalDelegationDelta:
        (poolData.delState[index]?.deltaDelegation ?? 0n) +
        (poolData.selfDelState[index]?.deltaDelegation ?? 0n),
      selfDelegation: poolData.selfDelState[index]?.totalDelegation ?? 0n,
      selfDelegationDelta: poolData.selfDelState[index]?.deltaDelegation ?? 0n,
      apyHistory: poolData.events
        .filter((event) => event.epoch > 0n)
        .map((event) => ({
          epoch: event.epoch,
          apy: convertEpochYieldToApy(
            (event.y * (event.eventData[index]?.otherRewardRatio ?? 0n)) /
              FRACTION_PRECISION_N,
          ),
          selfApy: convertEpochYieldToApy(
            (event.y * (event.eventData[index]?.selfRewardRatio ?? 0n)) /
              FRACTION_PRECISION_N,
          ),
        }))
        .sort((a, b) => Number(a.epoch) - Number(b.epoch)),
    }));
};
