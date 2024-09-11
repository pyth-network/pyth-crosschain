"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";
import { useIsSSR } from "react-aria";

import {
  type States,
  StateType as ApiStateType,
  useApi,
} from "../../hooks/use-api";
import {
  StateType as DashboardDataStateType,
  useData,
} from "../../hooks/use-data";
import { Button } from "../Button";
import { Dashboard } from "../Dashboard";
import { Error as ErrorPage } from "../Error";
import { Loading } from "../Loading";

export const Home = () => {
  const isSSR = useIsSSR();

  return isSSR ? <Loading /> : <MountedHome />;
};

const MountedHome = () => {
  const api = useApi();

  switch (api.type) {
    case ApiStateType.NotLoaded:
    case ApiStateType.LoadingStakeAccounts: {
      return <Loading />;
    }
    case ApiStateType.NoWallet: {
      return <NoWalletHome />;
    }
    case ApiStateType.ErrorLoadingStakeAccounts: {
      return <ErrorPage error={api.error} reset={api.reset} />;
    }
    case ApiStateType.LoadedNoStakeAccount:
    case ApiStateType.Loaded: {
      return <StakeAccountLoadedHome api={api} />;
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
        <Button onPress={showModal}>Connect your wallet to participate</Button>
      </div>
    </main>
  );
};

type StakeAccountLoadedHomeProps = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
};

const StakeAccountLoadedHome = ({ api }: StakeAccountLoadedHomeProps) => {
  const data = useData(api.dashboardDataCacheKey, api.loadData);

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
          <Dashboard {...data.data} api={api} />
        </main>
      );
    }
  }
};
