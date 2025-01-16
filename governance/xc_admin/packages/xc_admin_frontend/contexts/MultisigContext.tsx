import React, { createContext, useContext, useMemo } from 'react'
import { MultisigHookData, useMultisig } from '../hooks/useMultisig'

const MultisigContext = createContext<MultisigHookData | undefined>(undefined)

export const useMultisigContext = () => {
  const context = useContext(MultisigContext)
  if (!context) {
    throw new Error(
      'useMultisigContext must be used within a MultisigContext.Provider'
    )
  }
  return context
}

interface MultisigContextProviderProps {
  children?: React.ReactNode
}

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
  } = useMultisig()

  const value = useMemo(
    () => ({
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      isLoading,
      walletSquads,
      refreshData,
      connection,
      readOnlySquads,
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
    ]
  )

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  )
}
