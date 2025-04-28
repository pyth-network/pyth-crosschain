"use client";

import { HermesClient } from "@pythnetwork/hermes-client";
import type { PythStakingWallet } from "@pythnetwork/staking-sdk";
import { PythnetClient, PythStakingClient } from "@pythnetwork/staking-sdk";
import { useLocalStorageValue } from "@react-hookz/web";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import type { ComponentProps } from "react";
import { createContext, useContext, useMemo } from "react";
import { useSWRConfig } from "swr";

import { StateType as DataStateType, useData } from "./use-data";
import { useNetwork } from "./use-network";
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
  [StateType.NoWallet]: () => ({ type: StateType.NoWallet as const }),

  [StateType.WalletDisconnecting]: () => ({
    type: StateType.WalletDisconnecting as const,
  }),

  [StateType.WalletConnecting]: () => ({
    type: StateType.WalletConnecting as const,
  }),

  [StateType.NotLoaded]: (wallet: PythStakingWallet) => ({
    type: StateType.NotLoaded as const,
    wallet,
  }),

  [StateType.LoadingStakeAccounts]: (wallet: PythStakingWallet) => ({
    type: StateType.LoadingStakeAccounts as const,
    wallet,
  }),

  [StateType.LoadedNoStakeAccount]: (
    wallet: PythStakingWallet,
    isMainnet: boolean,
    client: PythStakingClient,
    pythnetClient: PythnetClient,
    hermesClient: HermesClient,
    onCreateAccount: (newAccount: PublicKey) => Promise<void>,
  ) => ({
    type: StateType.LoadedNoStakeAccount as const,
    dashboardDataCacheKey: [
      isMainnet ? "mainnet" : "devnet",
      client.wallet.publicKey.toBase58(),
    ],
    loadData: () => api.loadData(client, pythnetClient, hermesClient),
    deposit: async (amount: bigint) => {
      const account = await api.createStakeAccountAndDeposit(client, amount);
      return onCreateAccount(account);
    },
    wallet,
  }),

  [StateType.Loaded]: (
    wallet: PythStakingWallet,
    isMainnet: boolean,
    client: PythStakingClient,
    pythnetClient: PythnetClient,
    hermesClient: HermesClient,
    account: PublicKey,
    simulationPayer: PublicKey,
    allAccounts: [PublicKey, ...PublicKey[]],
    selectAccount: (account: PublicKey) => void,
    mutate: ReturnType<typeof useSWRConfig>["mutate"],
  ) => {
    const dashboardDataCacheKey = [
      isMainnet ? "mainnet" : "devnet",
      account.toBase58(),
    ];

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
        await mutate(dashboardDataCacheKey);
      };

    return {
      type: StateType.Loaded as const,
      account,
      allAccounts,
      selectAccount,
      dashboardDataCacheKey,
      wallet,

      loadData: () =>
        api.loadData(
          client,
          pythnetClient,
          hermesClient,
          account,
          simulationPayer,
        ),

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
      unstakeAllIntegrityStaking: bindApi(api.unstakeAllIntegrityStaking),
    };
  },

  [StateType.ErrorLoadingStakeAccounts]: (
    wallet: PythStakingWallet,
    error: LoadStakeAccountsError,
    reset: () => void,
  ) => ({
    type: StateType.ErrorLoadingStakeAccounts as const,
    error,
    reset,
    wallet,
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
  pythnetRpcUrl: string;
  hermesUrl: string;
  simulationPayerAddress: string;
};

export const ApiProvider = ({
  hermesUrl,
  pythnetRpcUrl,
  simulationPayerAddress,
  ...props
}: ApiProviderProps) => {
  const state = useApiContext(hermesUrl, pythnetRpcUrl, simulationPayerAddress);

  return <ApiContext.Provider value={state} {...props} />;
};

const useApiContext = (
  hermesUrl: string,
  pythnetRpcUrl: string,
  simulationPayerAddress: string,
) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { isMainnet } = useNetwork();
  const { mutate } = useSWRConfig();
  const hermesClient = useMemo(() => new HermesClient(hermesUrl), [hermesUrl]);
  const pythnetClient = useMemo(
    () => new PythnetClient(new Connection(pythnetRpcUrl)),
    [pythnetRpcUrl],
  );
  const simulationPayer = useMemo(
    () => new PublicKey(simulationPayerAddress),
    [simulationPayerAddress],
  );
  const pythStakingClient = useMemo(
    () =>
      wallet.publicKey && wallet.signAllTransactions && wallet.signTransaction
        ? new PythStakingClient({
            connection,
            wallet: {
              publicKey: wallet.publicKey,
              signAllTransactions: wallet.signAllTransactions,
              signTransaction: wallet.signTransaction,
              sendTransaction: wallet.sendTransaction,
            },
          })
        : undefined,
    [
      wallet.publicKey,
      wallet.signAllTransactions,
      wallet.signTransaction,
      wallet.sendTransaction,
      connection,
    ],
  );
  const stakeAccounts = useData(
    () =>
      pythStakingClient
        ? [isMainnet ? "mainnet" : "devnet", "stakeAccounts", wallet.publicKey]
        : undefined,
    () =>
      pythStakingClient
        ? api.getAllStakeAccountAddresses(pythStakingClient)
        : undefined,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const lastStakeAccountMainnet = useLocalStorageValue<string>(
    `last-stake-account.mainnet`,
  );
  const lastStakeAccountDevnet = useLocalStorageValue<string>(
    `last-stake-account.devnet`,
  );

  return useMemo(() => {
    if (wallet.connecting) {
      return State[StateType.WalletConnecting]();
    } else if (wallet.disconnecting) {
      return State[StateType.WalletDisconnecting]();
    } else if (wallet.connected && pythStakingClient) {
      switch (stakeAccounts.type) {
        case DataStateType.NotLoaded: {
          return State[StateType.NotLoaded](pythStakingClient.wallet);
        }
        case DataStateType.Loading: {
          return State[StateType.LoadingStakeAccounts](
            pythStakingClient.wallet,
          );
        }
        case DataStateType.Error: {
          return State[StateType.ErrorLoadingStakeAccounts](
            pythStakingClient.wallet,
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
              const localStorageValue = isMainnet
                ? lastStakeAccountMainnet
                : lastStakeAccountDevnet;
              const selectedAccount = localStorageValue.value
                ? stakeAccounts.data.find(
                    (account) => account.toBase58() === localStorageValue.value,
                  )
                : undefined;
              if (!selectedAccount) {
                localStorageValue.set(firstAccount.toBase58());
              }
              return State[StateType.Loaded](
                pythStakingClient.wallet,
                isMainnet,
                pythStakingClient,
                pythnetClient,
                hermesClient,
                selectedAccount ?? firstAccount,
                simulationPayer,
                [firstAccount, ...otherAccounts],
                (account: PublicKey) => {
                  localStorageValue.set(account.toBase58());
                },
                mutate,
              );
            } else {
              return State[StateType.LoadedNoStakeAccount](
                pythStakingClient.wallet,
                isMainnet,
                pythStakingClient,
                pythnetClient,
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
    isMainnet,
    wallet.connecting,
    wallet.disconnecting,
    wallet.connected,
    pythStakingClient,
    pythnetClient,
    stakeAccounts,
    hermesClient,
    lastStakeAccountMainnet,
    lastStakeAccountDevnet,
    mutate,
    simulationPayer,
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
