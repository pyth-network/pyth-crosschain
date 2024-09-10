import { PublicKey } from "@solana/web3.js";

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
      selfDelegation: poolData.selfDelState[index]?.totalDelegation ?? 0n,
      apyHistory: poolData.events
        .filter((event) => event.epoch > 0n)
        .map((event) => ({
          epoch: event.epoch,
          apy:
            (event.y * (event.eventData[index]?.otherRewardRatio ?? 0n)) /
            1_000_000n,
          selfApy:
            (event.y * (event.eventData[index]?.selfRewardRatio ?? 0n)) /
            1_000_000n,
        }))
        .sort((a, b) => Number(a.epoch) - Number(b.epoch)),
    }));
};
