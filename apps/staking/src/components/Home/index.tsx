"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";
import { useIsSSR } from "react-aria";

import {
  StateType as DashboardDataStateType,
  useDashboardData,
} from "../../hooks/use-dashboard-data";
import {
  StateType as StakeAccountStateType,
  useStakeAccount,
} from "../../hooks/use-stake-account";
import { Button } from "../Button";
import { Dashboard } from "../Dashboard";
import { Error as ErrorPage } from "../Error";
import { Loading } from "../Loading";

export const Home = () => {
  const isSSR = useIsSSR();

  return isSSR ? <Loading /> : <MountedHome />;
};

const MountedHome = () => {
  const stakeAccountState = useStakeAccount();

  switch (stakeAccountState.type) {
    case StakeAccountStateType.Initialized:
    case StakeAccountStateType.Loading: {
      return <Loading />;
    }
    case StakeAccountStateType.NoAccounts: {
      return (
        <main className="my-20">
          <p>No stake account found for your wallet!</p>
        </main>
      );
    }
    case StakeAccountStateType.NoWallet: {
      return <NoWalletHome />;
    }
    case StakeAccountStateType.Error: {
      return (
        <ErrorPage
          error={stakeAccountState.error}
          reset={stakeAccountState.reset}
        />
      );
    }
    case StakeAccountStateType.Loaded: {
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
    <main className="my-20">
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
    </main>
  );
};

const StakeAccountLoadedHome = () => {
  const data = useDashboardData();

  switch (data.type) {
    case DashboardDataStateType.NotLoaded:
    case DashboardDataStateType.Loading: {
      return <Loading />;
    }

    case DashboardDataStateType.Error: {
      return <ErrorPage error={data.error} reset={data.reset} />;
    }

    case DashboardDataStateType.Loaded: {
      return (
        <main className="mx-4 my-6">
          <Dashboard {...data.data} />
        </main>
      );
    }
  }
};
