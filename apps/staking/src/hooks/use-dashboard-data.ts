import { PublicKey } from "@solana/web3.js";
import { useCallback } from "react";
import useSWR from "swr";

import { useSelectedStakeAccount } from "./use-stake-account";
import { loadData } from "../api";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const getCacheKey = (stakeAccount: PublicKey) => stakeAccount.toBase58();

export const useDashboardData = () => {
  const { client, hermesClient, account } = useSelectedStakeAccount();

  const { data, isLoading, mutate, ...rest } = useSWR(
    getCacheKey(account.address),
    () => loadData(client, hermesClient, account),
    {
      refreshInterval: REFRESH_INTERVAL,
    },
  );
  const error = rest.error as unknown;

  const reset = useCallback(() => {
    mutate(undefined).catch(() => {
      /* no-op */
    });
  }, [mutate]);

  if (error) {
    return State.ErrorState(new LoadDashboardDataError(error), reset);
  } else if (isLoading) {
    return State.Loading();
  } else if (data) {
    return State.Loaded(data);
  } else {
    return State.NotLoaded();
  }
};

export enum StateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

const State = {
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  Loaded: (data: Awaited<ReturnType<typeof loadData>>) => ({
    type: StateType.Loaded as const,
    data,
  }),
  ErrorState: (error: LoadDashboardDataError, reset: () => void) => ({
    type: StateType.Error as const,
    error,
    reset,
  }),
};

type State = ReturnType<(typeof State)[keyof typeof State]>;

class LoadDashboardDataError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "");
    this.name = "LoadDashboardDataError";
    this.cause = cause;
  }
}
