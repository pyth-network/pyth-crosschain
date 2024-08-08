import {
  type WalletContextState,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import { type ComponentProps, useState, useCallback } from "react";

import { loadData } from "./api";
import type { DashboardLoaded } from "./components/Dashboard/loaded";

export const useTransfer = (
  transfer: (
    connection: Connection,
    wallet: WalletContextState,
  ) => Promise<void>,
  replaceData: ComponentProps<typeof DashboardLoaded>["replaceData"],
  onFinish?: (reset: () => void) => void,
) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<State>(State.Base());

  const reset = useCallback(() => {
    setState(State.Base());
  }, [setState]);

  const execute = useCallback(() => {
    setState(State.Submitting());
    transfer(connection, wallet)
      .then(() => {
        setState(State.LoadingData());
        loadData(connection, wallet)
          .then((data) => {
            replaceData(data);
            if (onFinish) {
              setState(State.Finished());
              onFinish(reset);
            } else {
              setState(State.Base());
            }
          })
          .catch((error: unknown) => {
            setState(State.ErrorLoadingData(error));
          });
      })
      .catch((error: unknown) => {
        setState(State.ErrorSubmitting(error));
      });
  }, [connection, wallet, transfer, replaceData, onFinish, setState, reset]);

  return { state, execute };
};

export enum StateType {
  Base,
  Submitting,
  LoadingData,
  ErrorSubmitting,
  ErrorLoadingData,
  Finished,
}

const State = {
  Base: () => ({ type: StateType.Base as const }),
  Submitting: () => ({ type: StateType.Submitting as const }),
  LoadingData: () => ({ type: StateType.LoadingData as const }),
  ErrorSubmitting: (error: unknown) => ({
    type: StateType.ErrorSubmitting as const,
    error,
  }),
  ErrorLoadingData: (error: unknown) => ({
    type: StateType.ErrorLoadingData as const,
    error,
  }),
  Finished: () => ({ type: StateType.Finished as const }),
};

type State = ReturnType<(typeof State)[keyof typeof State]>;
