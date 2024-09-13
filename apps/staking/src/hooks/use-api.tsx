"use client";

import { HermesClient } from "@pythnetwork/hermes-client";
import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import {
  type ComponentProps,
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import { useSWRConfig } from "swr";

import * as api from "../api";

export enum StateType {
  NotLoaded,
  NoWallet,
  LoadingStakeAccounts,
  LoadedNoStakeAccount,
  Loaded,
  ErrorLoadingStakeAccounts,
}

const State = {
  [StateType.NotLoaded]: () => ({ type: StateType.NotLoaded as const }),

  [StateType.NoWallet]: () => ({ type: StateType.NoWallet as const }),

  [StateType.LoadingStakeAccounts]: (
    client: PythStakingClient,
    hermesClient: HermesClient,
  ) => ({
    type: StateType.LoadingStakeAccounts as const,
    client,
    hermesClient,
  }),

  [StateType.LoadedNoStakeAccount]: (
    client: PythStakingClient,
    hermesClient: HermesClient,
    onCreateAccount: (newAccount: PublicKey) => void,
  ) => ({
    type: StateType.LoadedNoStakeAccount as const,
    client,
    hermesClient,
    dashboardDataCacheKey: client.wallet.publicKey.toBase58(),
    loadData: () => api.loadData(client, hermesClient),
    deposit: async (amount: bigint) => {
      const account = await api.createStakeAccountAndDeposit(client, amount);
      onCreateAccount(account);
    },
  }),

  [StateType.Loaded]: (
    client: PythStakingClient,
    hermesClient: HermesClient,
    account: PublicKey,
    allAccounts: [PublicKey, ...PublicKey[]],
    selectAccount: (account: PublicKey) => void,
    mutate: ReturnType<typeof useSWRConfig>["mutate"],
  ) => {
    const dashboardDataCacheKey = account.toBase58();
    const accountHistoryCacheKey = `${account.toBase58()}/history`;

    const reload = async () => {
      await Promise.all([
        mutate(dashboardDataCacheKey),
        mutate(accountHistoryCacheKey),
      ]);
    };

    const bindApi =
      <T extends unknown[]>(
        fn: (
          client: PythStakingClient,
          stakeAccount: PublicKey,
          ...args: T
        ) => Promise<void>,
      ) =>
      async (...args: T) => {
        await fn(client, account, ...args);
        await reload();
      };

    return {
      type: StateType.Loaded as const,
      client,
      hermesClient,
      account,
      allAccounts,
      selectAccount,
      dashboardDataCacheKey,
      accountHistoryCacheKey,

      loadData: () => api.loadData(client, hermesClient, account),
      loadAccountHistory: () => api.loadAccountHistory(client, account),

      claim: bindApi(api.claim),
      deposit: bindApi(api.deposit),
      withdraw: bindApi(api.withdraw),
      stakeGovernance: bindApi(api.stakeGovernance),
      cancelWarmupGovernance: bindApi(api.cancelWarmupGovernance),
      unstakeGovernance: bindApi(api.unstakeGovernance),
      delegateIntegrityStaking: bindApi(api.delegateIntegrityStaking),
      unstakeIntegrityStaking: bindApi(api.unstakeIntegrityStaking),
      cancelWarmupIntegrityStaking: bindApi(api.cancelWarmupIntegrityStaking),
      reassignPublisherAccount: bindApi(api.reassignPublisherAccount),
      optPublisherOut: bindApi(api.optPublisherOut),
    };
  },

  [StateType.ErrorLoadingStakeAccounts]: (
    client: PythStakingClient,
    error: LoadStakeAccountsError,
    reset: () => void,
  ) => ({
    type: StateType.ErrorLoadingStakeAccounts as const,
    client,
    error,
    reset,
  }),
};

export type States = {
  [key in keyof typeof State]: ReturnType<(typeof State)[key]>;
};
export type State = States[keyof States];

const ApiContext = createContext<State | undefined>(undefined);

type ApiProviderProps = Omit<
  ComponentProps<typeof ApiContext.Provider>,
  "value"
> & {
  hermesUrl: string;
};

export const ApiProvider = ({ hermesUrl, ...props }: ApiProviderProps) => {
  const state = useApiContext(hermesUrl);

  return <ApiContext.Provider value={state} {...props} />;
};

const useApiContext = (hermesUrl: string) => {
  const loading = useRef(false);
  const wallet = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<State>(State[StateType.NotLoaded]());
  const { mutate } = useSWRConfig();

  const setAccount = useCallback(
    (account: PublicKey) => {
      setState((cur) =>
        cur.type === StateType.Loaded
          ? State[StateType.Loaded](
              cur.client,
              cur.hermesClient,
              account,
              cur.allAccounts,
              setAccount,
              mutate,
            )
          : cur,
      );
    },
    [setState, mutate],
  );

  const reset = useCallback(() => {
    if (wallet.connected && !wallet.disconnecting && !loading.current) {
      loading.current = true;
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
      const hermesClient = new HermesClient(hermesUrl);
      setState(State[StateType.LoadingStakeAccounts](client, hermesClient));
      api
        .getAllStakeAccountAddresses(client)
        .then((accounts) => {
          const [firstAccount, ...otherAccounts] = accounts;
          if (firstAccount) {
            setState(
              State[StateType.Loaded](
                client,
                hermesClient,
                firstAccount,
                [firstAccount, ...otherAccounts],
                setAccount,
                mutate,
              ),
            );
          } else {
            setState(
              State[StateType.LoadedNoStakeAccount](
                client,
                hermesClient,
                (newAccount) => {
                  setState(
                    State[StateType.Loaded](
                      client,
                      hermesClient,
                      newAccount,
                      [newAccount],
                      setAccount,
                      mutate,
                    ),
                  );
                },
              ),
            );
          }
        })
        .catch((error: unknown) => {
          setState(
            State[StateType.ErrorLoadingStakeAccounts](
              client,
              new LoadStakeAccountsError(error),
              reset,
            ),
          );
        })
        .finally(() => {
          loading.current = false;
        });
    }
  }, [connection, setAccount, wallet, mutate, hermesUrl]);

  useEffect(() => {
    reset();
  }, [reset]);

  return wallet.connected && !wallet.disconnecting
    ? state
    : State[StateType.NoWallet]();
};

export const useApi = () => {
  const state = useContext(ApiContext);
  if (state === undefined) {
    throw new NotInitializedError();
  } else {
    return state;
  }
};

class LoadStakeAccountsError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "");
    this.name = "LoadStakeAccountsError";
    this.cause = cause;
  }
}

class NotInitializedError extends Error {
  constructor() {
    super(
      "This component must be a child of <WalletProvider> to use the `useWallet` hook",
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
