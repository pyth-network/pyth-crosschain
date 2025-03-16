import { useCallback } from "react";
import type { KeyedMutator } from "swr";
import useSWR from "swr";

import { useLogger } from "./use-logger";

export const useData = <T>(...args: Parameters<typeof useSWR<T>>) => {
  const { data, isLoading, mutate, ...rest } = useSWR(...args);

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
    return State.Loaded(data, mutate);
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
  Loaded: <T>(data: T, mutate: KeyedMutator<T>) => ({
    type: StateType.Loaded as const,
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
