import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

import { StateType, useStakeAccount } from "./use-stake-account";
import type { Context } from "../api";

export const useApiContext = (): Context => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const stakeAccount = useStakeAccount();

  if (wallet === undefined) {
    throw new NoWalletConnectedError();
  }

  if (stakeAccount.type !== StateType.Loaded) {
    throw new NoStakeAccountSelectedError();
  }

  return useMemo(
    () => ({ wallet, connection, stakeAccount: stakeAccount.account }),
    [wallet, connection, stakeAccount],
  );
};

class NoWalletConnectedError extends Error {
  constructor() {
    super(
      "The `useApiContext` hook cannot be called if a wallet isn't connected!  Ensure all components that use this hook are only rendered if a wallet is connected!",
    );
  }
}

class NoStakeAccountSelectedError extends Error {
  constructor() {
    super(
      "The `useApiContext` hook cannot be called before stake accounts have loaded!  Ensure all components that use this hook are only rendered if `useStakeAccount` returns a loaded state!",
    );
  }
}
