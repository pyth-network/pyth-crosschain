import { useCallback } from "react";
import type { KeyedMutator } from "swr";
import useSWR from "swr";

import { useLogger } from "../useLogger";

export const useData = <T>(
  key: Parameters<typeof useSWR<T>>[0],
  fetcher?: Parameters<typeof useSWR<T>>[1],
  config?: Parameters<typeof useSWR<T>>[2],
) => {
  const { data, isLoading, isValidating, mutate, ...rest } = useSWR(
    key,
    // eslint-disable-next-line unicorn/no-null
    fetcher ?? null,
    config,
  );

  const error = rest.error as unknown;
  const logger = useLogger();

  const reset = useCallback(() => {
    mutate(undefined).catch(() => {
      /* no-op */
    });
  }, [mutate]);

  if (error) {
    logger.error(error);
    return State.ErrorState(new UseDataError(error), reset);
  } else if (isLoading) {
    return State.Loading();
  } else if (data) {
    return State.Loaded(data, isValidating, mutate);
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
  Loaded: <T>(data: T, isValidating: boolean, mutate: KeyedMutator<T>) => ({
    type: StateType.Loaded as const,
    isValidating,
    mutate,
    data,
  }),
  ErrorState: (error: UseDataError, reset: () => void) => ({
    type: StateType.Error as const,
    error,
    reset,
  }),
};

class UseDataError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "");
    this.name = "UseDataError";
    this.cause = cause;
  }
}
