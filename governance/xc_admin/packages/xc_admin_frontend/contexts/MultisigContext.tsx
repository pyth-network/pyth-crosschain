"use client";

import type React from "react";
import { createContext, useContext, useMemo } from "react";

import type { MultisigHookData } from "../hooks/useMultisig";
import { useMultisig } from "../hooks/useMultisig";

const MultisigContext = createContext<MultisigHookData | undefined>(undefined);

export const useMultisigContext = () => {
  const context = useContext(MultisigContext);
  if (!context) {
    throw new Error(
      "useMultisigContext must be used within a MultisigContext.Provider",
    );
  }
  return context;
};

type MultisigContextProviderProps = {
  children?: React.ReactNode;
};

export const MultisigContextProvider: React.FC<
  MultisigContextProviderProps
> = ({ children }) => {
  const {
    isLoading,
    walletSquads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    refreshData,
    connection,
    readOnlySquads,
  } = useMultisig();

  const value = useMemo(
    () => ({
      connection,
      isLoading,
      priceFeedMultisigAccount,
      priceFeedMultisigProposals,
      readOnlySquads,
      refreshData,
      upgradeMultisigAccount,
      upgradeMultisigProposals,
      walletSquads,
    }),
    [
      walletSquads,
      isLoading,
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      refreshData,
      connection,
      readOnlySquads,
    ],
  );

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  );
};
