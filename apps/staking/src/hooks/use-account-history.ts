import useSWR from "swr";

import { useApiContext } from "./use-api-context";
import { loadAccountHistory } from "../api";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const getCacheKey = ({
  stakeAccount,
}: ReturnType<typeof useApiContext>) =>
  `${stakeAccount.address.toBase58()}/history`;

export const useAccountHistory = () => {
  const apiContext = useApiContext();

  const { data, isLoading, ...rest } = useSWR(
    getCacheKey(apiContext),
    () => loadAccountHistory(apiContext),
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
