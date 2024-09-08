import { PublicKey } from "@solana/web3.js";
import useSWR from "swr";

import { useSelectedStakeAccount } from "./use-stake-account";
import { loadAccountHistory } from "../api";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const getCacheKey = (stakeAccount: PublicKey) =>
  `${stakeAccount.toBase58()}/history`;

export const useAccountHistory = () => {
  const { client, account } = useSelectedStakeAccount();

  const { data, isLoading, ...rest } = useSWR(
    getCacheKey(account.address),
    () => loadAccountHistory(client, account.address),
    {
      refreshInterval: REFRESH_INTERVAL,
    },
  );
  const error = rest.error as unknown;

  if (error) {
    return State.ErrorState(error);
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
  Loaded: (data: Awaited<ReturnType<typeof loadAccountHistory>>) => ({
    type: StateType.Loaded as const,
    data,
  }),
  ErrorState: (error: unknown) => ({
    type: StateType.Error as const,
    error,
  }),
};
type State = ReturnType<(typeof State)[keyof typeof State]>;
