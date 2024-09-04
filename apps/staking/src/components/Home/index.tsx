"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";
import { useIsSSR } from "react-aria";
import useSWR from "swr";

import { loadData } from "../../api";
import { useApiContext } from "../../hooks/use-api-context";
import { StateType, useStakeAccount } from "../../hooks/use-stake-account";
import { Button } from "../Button";
import { Dashboard } from "../Dashboard";
import { LoadingSpinner } from "../LoadingSpinner";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const Home = () => {
  const isSSR = useIsSSR();

  return (
    <main className="mx-4 my-6">
      {isSSR ? <LoadingSpinner /> : <MountedHome />}
    </main>
  );
};

const MountedHome = () => {
  const stakeAccountState = useStakeAccount();

  switch (stakeAccountState.type) {
    case StateType.Initialized:
    case StateType.Loading: {
      return <LoadingSpinner />;
    }
    case StateType.NoAccounts: {
      return <p>No stake account found for your wallet!</p>;
    }
    case StateType.NoWallet: {
      return <NoWalletHome />;
    }
    case StateType.Error: {
      return (
        <p>
          Uh oh, an error occurred while loading stake accounts. Please refresh
          and try again
        </p>
      );
    }
    case StateType.Loaded: {
      return <StakeAccountLoadedHome />;
    }
  }
};

const NoWalletHome = () => {
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);

  return (
    <>
      <h1 className="mb-8 mt-16 text-center text-4xl font-semibold text-pythpurple-400">
        Staking & Delegating
      </h1>
      <p className="mx-auto mb-8 max-w-prose text-center">
        The Pyth staking program allows you to stake tokens to participate in
        governance, or to earn yield and protect DeFi by delegating to
        publishers.
      </p>
      <div className="grid w-full place-content-center">
        <Button onClick={showModal}>Connect your wallet to participate</Button>
      </div>
    </>
  );
};

const StakeAccountLoadedHome = () => {
  const data = useDashboardData();

  switch (data.type) {
    case DataStateType.NotLoaded:
    case DataStateType.Loading: {
      return <LoadingSpinner />;
    }
    case DataStateType.Error: {
      return <p>Uh oh, an error occured!</p>;
    }
    case DataStateType.Loaded: {
      return <Dashboard {...data.data} />;
    }
  }
};

const useDashboardData = () => {
  const apiContext = useApiContext();

  const { data, isLoading, ...rest } = useSWR(
    apiContext.stakeAccount.address.toBase58(),
    () => loadData(apiContext),
    {
      refreshInterval: REFRESH_INTERVAL,
    },
  );
  const error = rest.error as unknown;

  if (error) {
    return DataState.ErrorState(error);
  } else if (isLoading) {
    return DataState.Loading();
  } else if (data) {
    return DataState.Loaded(data);
  } else {
    return DataState.NotLoaded();
  }
};

enum DataStateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}
const DataState = {
  NotLoaded: () => ({ type: DataStateType.NotLoaded as const }),
  Loading: () => ({ type: DataStateType.Loading as const }),
  Loaded: (data: Awaited<ReturnType<typeof loadData>>) => ({
    type: DataStateType.Loaded as const,
    data,
  }),
  ErrorState: (error: unknown) => ({
    type: DataStateType.Error as const,
    error,
  }),
};
type DataState = ReturnType<(typeof DataState)[keyof typeof DataState]>;
