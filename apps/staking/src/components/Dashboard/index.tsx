"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { type ComponentProps, useCallback, useEffect, useState } from "react";

import { DashboardLoaded } from "./loaded";
import { loadData } from "../../api";

export const Dashboard = () => {
  const { data, replaceData } = useDashboardData();

  switch (data.type) {
    case DataStateType.NotLoaded:
    case DataStateType.Loading: {
      return <ArrowPathIcon className="size-6 animate-spin" />;
    }
    case DataStateType.Error: {
      return <p>Uh oh, an error occured!</p>;
    }
    case DataStateType.Loaded: {
      return <DashboardLoaded {...data.data} replaceData={replaceData} />;
    }
  }
};

type DashboardData = Omit<
  ComponentProps<typeof DashboardLoaded>,
  "replaceData"
>;

const useDashboardData = () => {
  const [data, setData] = useState<DataState>(DataState.NotLoaded());
  const wallet = useWallet();
  const { connection } = useConnection();

  const replaceData = useCallback(
    (newData: DashboardData) => {
      setData(DataState.Loaded(newData));
    },
    [setData],
  );

  useEffect(() => {
    if (data.type === DataStateType.NotLoaded) {
      setData(DataState.Loading());
      const abortController = new AbortController();
      loadData(connection, wallet, abortController.signal)
        .then((data) => {
          setData(DataState.Loaded(data));
        })
        .catch((error: unknown) => {
          setData(DataState.ErrorState(error));
        });
      return () => {
        abortController.abort();
      };
    } else {
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, replaceData };
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
  Loaded: (data: DashboardData) => ({
    type: DataStateType.Loaded as const,
    data,
  }),
  ErrorState: (error: unknown) => ({
    type: DataStateType.Error as const,
    error,
  }),
};
type DataState = ReturnType<(typeof DataState)[keyof typeof DataState]>;
