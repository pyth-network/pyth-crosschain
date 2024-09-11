import { useState, useCallback } from "react";

import { useLogger } from "./use-logger";

export const useAsync = (fn: () => Promise<void>) => {
  const logger = useLogger();
  const [state, setState] = useState<State>(State.Base());

  const execute = useCallback(async () => {
    if (state.type === StateType.Running) {
      throw new AlreadyInProgressError();
    }

    setState(State.Running());
    try {
      await fn();
      setState(State.Complete());
    } catch (error: unknown) {
      logger.error(error);
      setState(State.ErrorState(error));
      throw error;
    }
  }, [state, fn, setState, logger]);

  return { state, execute };
};

export enum StateType {
  Base,
  Running,
  Error,
  Complete,
}

const State = {
  Base: () => ({ type: StateType.Base as const }),
  Running: () => ({ type: StateType.Running as const }),
  Complete: () => ({ type: StateType.Complete as const }),
  ErrorState: (error: unknown) => ({
    type: StateType.Error as const,
    error,
  }),
};

type State = ReturnType<(typeof State)[keyof typeof State]>;

class AlreadyInProgressError extends Error {
  constructor() {
    super("Can't run async hook when already in progress");
    this.name = "AlreadyInProgressError";
  }
}
