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

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

export const Home = () => <HomeImpl />;
export const RestrictedMode = () => <HomeImpl restrictedMode />;

type HomeImplProps = {
  restrictedMode?: boolean | undefined;
};

export const HomeImpl = ({ restrictedMode }: HomeImplProps) => {
  const isSSR = useIsSSR();

  return isSSR ? <Loading /> : <MountedHome restrictedMode={restrictedMode} />;
};

type MountedHomeProps = {
  restrictedMode?: boolean | undefined;
};

const MountedHome = ({ restrictedMode }: MountedHomeProps) => {
  const api = useApi();

  switch (api.type) {
    case ApiStateType.NotLoaded:
    case ApiStateType.LoadingStakeAccounts: {
      return <Loading />;
    }
    case ApiStateType.WalletDisconnecting:
    case ApiStateType.WalletConnecting:
    case ApiStateType.NoWallet: {
      return <NoWalletHome />;
    }
    case ApiStateType.ErrorLoadingStakeAccounts: {
      return <ErrorPage error={api.error} reset={api.reset} />;
    }
    case ApiStateType.LoadedNoStakeAccount:
    case ApiStateType.Loaded: {
      return (
        <StakeAccountLoadedHome restrictedMode={restrictedMode} api={api} />
      );
    }
  }
};

type StakeAccountLoadedHomeProps = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  restrictedMode?: boolean | undefined;
};

const StakeAccountLoadedHome = ({
  api,
  restrictedMode,
}: StakeAccountLoadedHomeProps) => {
  const data = useData(api.dashboardDataCacheKey, api.loadData, {
    refreshInterval: REFRESH_INTERVAL,
  });

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
        <Dashboard {...data.data} api={api} restrictedMode={restrictedMode} />
      );
    }
  }
};
