"use client";

import type { StakeAccountPositions } from "@pythnetwork/staking-sdk/src/staking/accounts";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  type ComponentProps,
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";

import { getStakeAccounts } from "../api";

export enum StateType {
  Initialized,
  NoWallet,
  Loading,
  NoAccounts,
  Loaded,
  Error,
}

const State = {
  Initialized: () => ({ type: StateType.Initialized as const }),
  NoWallet: () => ({ type: StateType.NoWallet as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  NoAccounts: () => ({ type: StateType.NoAccounts as const }),
  Loaded: (
    account: StakeAccountPositions,
    allAccounts: [StakeAccountPositions, ...StakeAccountPositions[]],
    selectAccount: (account: StakeAccountPositions) => void,
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
  const loading = useRef(false);
  const wallet = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<State>(State.Initialized());

  const setAccount = useCallback(
    (account: StakeAccountPositions) => {
      setState((cur) =>
        cur.type === StateType.Loaded
          ? State.Loaded(account, cur.allAccounts, setAccount)
          : cur,
      );
    },
    [setState],
  );

  useEffect(() => {
    if (wallet.connected && !wallet.disconnecting && !loading.current) {
      loading.current = true;
      setState(State.Loading());
      if (
        !wallet.publicKey ||
        !wallet.signAllTransactions ||
        !wallet.signTransaction
      ) {
        throw new WalletConnectedButInvalidError();
      }
      getStakeAccounts(connection, {
        publicKey: wallet.publicKey,
        signAllTransactions: wallet.signAllTransactions,
        signTransaction: wallet.signTransaction,
      })
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
        })
        .finally(() => {
          loading.current = false;
        });
    }
  }, [connection, setAccount, wallet]);

  return wallet.connected && !wallet.disconnecting ? state : State.NoWallet();
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

class WalletConnectedButInvalidError extends Error {
  constructor() {
    super(
      "The wallet is connected but is missing a public key or methods to sign transactions!",
    );
  }
}
