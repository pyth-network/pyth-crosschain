"use client";

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
import { Dashboard } from "../Dashboard";
import { Error as ErrorPage } from "../Error";
import { Loading } from "../Loading";
import { NoWalletHome } from "../NoWalletHome";

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
