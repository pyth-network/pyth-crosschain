import type { PythStakingClient } from "@pythnetwork/staking-sdk";
import type { PublicKey } from "@solana/web3.js";
import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";

import { getCacheKey as getAccountHistoryCacheKey } from "./use-account-history";
import { getCacheKey as getDashboardDataCacheKey } from "./use-dashboard-data";
import { useSelectedStakeAccount } from "./use-stake-account";

export const useTransfer = (
  transfer: (
    client: PythStakingClient,
    stakingAccount: PublicKey,
  ) => Promise<void>,
) => {
  const { client, account } = useSelectedStakeAccount();
  const [state, setState] = useState<State>(State.Base());
  const { mutate } = useSWRConfig();

  const execute = useCallback(async () => {
    if (state.type === StateType.Submitting) {
      throw new DuplicateSubmitError();
    }

    setState(State.Submitting());
    try {
      await transfer(client, account.address);
      // TODO enable mutate without awaiting?
      // Prob by changing `api.ts` to encode the change & history item along with each update?
      await Promise.all([
        mutate(getDashboardDataCacheKey(account.address)),
        mutate(getAccountHistoryCacheKey(account.address)),
      ]);
      setState(State.Complete());
    } catch (error: unknown) {
      setState(State.ErrorState(error));
      throw error;
    }
  }, [state, client, account.address, transfer, setState, mutate]);

  return { state, execute };
};

export enum StateType {
  Base,
  Submitting,
  Error,
  Complete,
}

const State = {
  Base: () => ({ type: StateType.Base as const }),
  Submitting: () => ({ type: StateType.Submitting as const }),
  Complete: () => ({ type: StateType.Complete as const }),
  ErrorState: (error: unknown) => ({
    type: StateType.Error as const,
    error,
  }),
};

type State = ReturnType<(typeof State)[keyof typeof State]>;

class DuplicateSubmitError extends Error {
  constructor() {
    super("Attempted to submit a transaction when one is already in process");
    this.name = "DuplicateSubmitError";
  }
}
