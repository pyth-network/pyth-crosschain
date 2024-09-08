import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";

import { getCacheKey as getAccountHistoryCacheKey } from "./use-account-history";
import { useApiContext } from "./use-api-context";
import { getCacheKey as getDashboardDataCacheKey } from "./use-dashboard-data";

export const useTransfer = (
  transfer: (context: ReturnType<typeof useApiContext>) => Promise<void>,
) => {
  const context = useApiContext();
  const [state, setState] = useState<State>(State.Base());
  const { mutate } = useSWRConfig();

  const execute = useCallback(async () => {
    if (state.type === StateType.Submitting) {
      throw new DuplicateSubmitError();
    }

    setState(State.Submitting());
    try {
      await transfer(context);
      // TODO enable mutate without awaiting?
      // Prob by changing `api.ts` to encode the change & history item along with each update?
      await Promise.all([
        mutate(getDashboardDataCacheKey(context)),
        mutate(getAccountHistoryCacheKey(context)),
      ]);
      setState(State.Complete());
    } catch (error: unknown) {
      setState(State.ErrorState(error));
      throw error;
    }
  }, [state, context, transfer, setState, mutate]);

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
  }
}
