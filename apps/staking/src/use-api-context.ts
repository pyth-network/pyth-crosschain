import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

import type { Context } from "./api";
import { StateType, useStakeAccount } from "./use-stake-account";

export type { Context } from "./api";

export const useApiContext = (): Context => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const stakeAccount = useStakeAccount();

  if (stakeAccount.type !== StateType.Loaded) {
    throw new NoStakeAccountSelectedError();
  }

  return useMemo(
    () => ({ wallet, connection, stakeAccount: stakeAccount.account }),
    [wallet, connection, stakeAccount],
  );
};

class NoStakeAccountSelectedError extends Error {
  constructor() {
    super(
      "The `useApiContext` hook cannot be called before stake accounts have loaded!  Ensure all components that use this hook are only rendered if `useStakeAccount` returns a loaded state!",
    );
  }
}
