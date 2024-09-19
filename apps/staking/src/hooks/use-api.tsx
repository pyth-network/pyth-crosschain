"use client";

import { HermesClient } from "@pythnetwork/hermes-client";
import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { useLocalStorageValue } from "@react-hookz/web";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { type ComponentProps, createContext, useContext, useMemo } from "react";
import { useSWRConfig } from "swr";

import { StateType as DataStateType, useData } from "./use-data";
import * as api from "../api";

export enum StateType {
  NotLoaded,
  NoWallet,
  WalletDisconnecting,
  WalletConnecting,
  LoadingStakeAccounts,
  LoadedNoStakeAccount,
  Loaded,
  ErrorLoadingStakeAccounts,
}

const State = {
  [StateType.NotLoaded]: () => ({ type: StateType.NotLoaded as const }),

  [StateType.NoWallet]: () => ({ type: StateType.NoWallet as const }),

  [StateType.WalletDisconnecting]: () => ({
    type: StateType.WalletDisconnecting as const,
  }),

  [StateType.WalletConnecting]: () => ({
    type: StateType.WalletConnecting as const,
  }),

  [StateType.LoadingStakeAccounts]: () => ({
    type: StateType.LoadingStakeAccounts as const,
  }),

  [StateType.LoadedNoStakeAccount]: (
    client: PythStakingClient,
    hermesClient: HermesClient,
    onCreateAccount: (newAccount: PublicKey) => Promise<void>,
  ) => ({
    type: StateType.LoadedNoStakeAccount as const,
    dashboardDataCacheKey: client.wallet.publicKey.toBase58(),
    loadData: () => api.loadData(client, hermesClient),
    deposit: async (amount: bigint) => {
      const account = await api.createStakeAccountAndDeposit(client, amount);
      return onCreateAccount(account);
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
    error: LoadStakeAccountsError,
    reset: () => void,
  ) => ({ type: StateType.ErrorLoadingStakeAccounts as const, error, reset }),
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
  const wallet = useWallet();
  const { connection } = useConnection();
  const { mutate } = useSWRConfig();
  const hermesClient = useMemo(() => new HermesClient(hermesUrl), [hermesUrl]);
  const pythStakingClient = useMemo(
    () =>
      wallet.publicKey && wallet.signAllTransactions && wallet.signTransaction
        ? new PythStakingClient({
            connection,
            wallet: {
              publicKey: wallet.publicKey,
              signAllTransactions: wallet.signAllTransactions,
              signTransaction: wallet.signTransaction,
            },
          })
        : undefined,
    [
      wallet.publicKey,
      wallet.signAllTransactions,
      wallet.signTransaction,
      connection,
    ],
  );
  const stakeAccounts = useData(
    () => (pythStakingClient ? ["stakeAccounts", wallet.publicKey] : undefined),
    () =>
      pythStakingClient
        ? api.getAllStakeAccountAddresses(pythStakingClient)
        : undefined,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const lastStakeAccount = useLocalStorageValue<string>("last-stake-account");

  return useMemo(() => {
    if (wallet.connecting) {
      return State[StateType.WalletConnecting]();
    } else if (wallet.disconnecting) {
      return State[StateType.WalletDisconnecting]();
    } else if (wallet.connected && pythStakingClient) {
      switch (stakeAccounts.type) {
        case DataStateType.NotLoaded: {
          return State[StateType.NotLoaded]();
        }
        case DataStateType.Loading: {
          return State[StateType.LoadingStakeAccounts]();
        }
        case DataStateType.Error: {
          return State[StateType.ErrorLoadingStakeAccounts](
            new LoadStakeAccountsError(stakeAccounts.error),
            stakeAccounts.reset,
          );
        }
        case DataStateType.Loaded: {
          if (stakeAccounts.data === undefined) {
            throw new InvalidStateError();
          } else {
            const [firstAccount, ...otherAccounts] = stakeAccounts.data;
            if (firstAccount) {
              const selectedAccount = lastStakeAccount.value
                ? stakeAccounts.data.find(
                    (account) => account.toBase58() === lastStakeAccount.value,
                  )
                : undefined;
              return State[StateType.Loaded](
                pythStakingClient,
                hermesClient,
                selectedAccount ?? firstAccount,
                [firstAccount, ...otherAccounts],
                (account: PublicKey) => {
                  lastStakeAccount.set(account.toBase58());
                },
                mutate,
              );
            } else {
              return State[StateType.LoadedNoStakeAccount](
                pythStakingClient,
                hermesClient,
                async (newAccount) => {
                  await stakeAccounts.mutate([newAccount]);
                },
              );
            }
          }
        }
      }
    } else {
      return State[StateType.NoWallet]();
    }
  }, [
    wallet.connecting,
    wallet.disconnecting,
    wallet.connected,
    pythStakingClient,
    stakeAccounts,
    hermesClient,
    lastStakeAccount,
    mutate,
  ]);
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
    this.name = "NotInitializedError";
  }
}

class InvalidStateError extends Error {
  constructor() {
    super(
      "State invariant expectation failed: stake accounts were loaded but no data was returned",
    );
    this.name = "InvalidStateError";
  }
}
