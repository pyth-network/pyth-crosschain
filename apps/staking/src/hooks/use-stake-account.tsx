"use client";

import { HermesClient } from "@pythnetwork/hermes-client";
import type { StakeAccountPositions } from "@pythnetwork/staking-sdk";
import { PythStakingClient } from "@pythnetwork/staking-sdk";
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

  NoAccounts: (client: PythStakingClient) => ({
    type: StateType.NoAccounts as const,
    client,
  }),

  Loaded: (
    client: PythStakingClient,
    hermesClient: HermesClient,
    account: StakeAccountPositions,
    allAccounts: [StakeAccountPositions, ...StakeAccountPositions[]],
    selectAccount: (account: StakeAccountPositions) => void,
  ) => ({
    type: StateType.Loaded as const,
    client,
    hermesClient,
    account,
    allAccounts,
    selectAccount,
  }),

  ErrorState: (
    client: PythStakingClient,
    error: LoadStakeAccountError,
    reset: () => void,
  ) => ({
    type: StateType.Error as const,
    client,
    error,
    reset,
  }),
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
          ? State.Loaded(cur.client, cur.hermesClient, account, cur.allAccounts, setAccount)
          : cur,
      );
    },
    [setState],
  );

  const reset = useCallback(() => {
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
      const client = new PythStakingClient({
        connection,
        wallet: {
          publicKey: wallet.publicKey,
          signAllTransactions: wallet.signAllTransactions,
          signTransaction: wallet.signTransaction,
        },
      });
      // TODO: use env var to support mainnet
      const hermesClient = new HermesClient("https://hermes-beta.pyth.network");
      getStakeAccounts(client)
        .then((accounts) => {
          const [firstAccount, ...otherAccounts] = accounts;
          if (firstAccount) {
            setState(
              State.Loaded(
                client,
                hermesClient,
                firstAccount,
                [firstAccount, ...otherAccounts],
                setAccount,
              ),
            );
          } else {
            setState(State.NoAccounts(client));
          }
        })
        .catch((error: unknown) => {
          setState(
            State.ErrorState(client, new LoadStakeAccountError(error), reset),
          );
        })
        .finally(() => {
          loading.current = false;
        });
    }
  }, [connection, setAccount, wallet]);

  useEffect(() => {
    reset();
  }, [reset]);

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

export const useSelectedStakeAccount = () => {
  const state = useStakeAccount();
  if (state.type === StateType.Loaded) {
    return state;
  } else {
    throw new InvalidStateError();
  }
};

class LoadStakeAccountError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "");
    this.name = "LoadStakeAccountError";
    this.cause = cause;
  }
}

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

class InvalidStateError extends Error {
  constructor() {
    super(
      "Cannot use `useSelectedStakeAccount` when stake accounts aren't loaded or a stake account isn't selected!  Ensure this hook is only called when a stake account is selected.",
    );
    this.name = "InvalidStateError";
  }
}
