"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ComponentProps,
} from "react";

import { type StakeAccount, getStakeAccounts } from "../api";

export enum StateType {
  Initialized,
  Loading,
  NoAccounts,
  Loaded,
  Error,
}

const State = {
  Initialized: () => ({ type: StateType.Initialized as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  NoAccounts: () => ({ type: StateType.NoAccounts as const }),
  Loaded: (
    account: StakeAccount,
    allAccounts: [StakeAccount, ...StakeAccount[]],
    selectAccount: (account: StakeAccount) => void,
  ) => ({
    type: StateType.Loaded as const,
    account,
    allAccounts,
    selectAccount,
  }),
  ErrorState: (error: unknown) => ({ type: StateType.Error as const, error }),
};

type State = ReturnType<(typeof State)[keyof typeof State]>;

const StakeAccountContext = createContext<State | undefined>(undefined);

export const StakeAccountProvider = (
  props: Omit<ComponentProps<typeof StakeAccountContext.Provider>, "value">,
) => {
  const state = useStakeAccountState();

  return <StakeAccountContext.Provider value={state} {...props} />;
};

const useStakeAccountState = () => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<State>(State.Initialized());

  const setAccount = useCallback(
    (account: StakeAccount) => {
      setState((cur) =>
        cur.type === StateType.Loaded
          ? State.Loaded(account, cur.allAccounts, setAccount)
          : cur,
      );
    },
    [setState],
  );

  useEffect(() => {
    setState(State.Loading());
    getStakeAccounts(connection, wallet)
      .then((accounts) => {
        const [firstAccount, ...otherAccounts] = accounts;
        if (firstAccount) {
          setState(
            State.Loaded(
              firstAccount,
              [firstAccount, ...otherAccounts],
              setAccount,
            ),
          );
        } else {
          setState(State.NoAccounts());
        }
      })
      .catch((error: unknown) => {
        setState(State.ErrorState(error));
      });
  }, [connection, setAccount, wallet]);

  return state;
};

export const useStakeAccount = () => {
  const state = useContext(StakeAccountContext);
  if (state === undefined) {
    throw new NotInitializedError();
  } else {
    return state;
  }
};

class NotInitializedError extends Error {
  constructor() {
    super(
      "This component must be a child of <StakeAccountProvider> to use the `useStakeAccount` hook",
    );
  }
}
