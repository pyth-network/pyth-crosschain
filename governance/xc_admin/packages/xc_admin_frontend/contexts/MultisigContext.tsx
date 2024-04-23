import React, { createContext, useContext, useMemo } from 'react'
import { MultisigHookData, useMultisig } from '../hooks/useMultisig'

const MultisigContext = createContext<MultisigHookData>({
  upgradeMultisigAccount: undefined,
  priceFeedMultisigAccount: undefined,
  upgradeMultisigProposals: [],
  priceFeedMultisigProposals: [],
  isLoading: true,
  squads: undefined,
  refreshData: undefined,
  connection: undefined,
})

export const useMultisigContext = () => useContext(MultisigContext)

interface MultisigContextProviderProps {
  children?: React.ReactNode
}

export const MultisigContextProvider: React.FC<
  MultisigContextProviderProps
> = ({ children }) => {
  const {
    isLoading,
    squads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    refreshData,
    connection,
  } = useMultisig()

  const value = useMemo(
    () => ({
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      isLoading,
      squads,
      refreshData,
      connection,
    }),
    [
      squads,
      isLoading,
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      refreshData,
      connection,
    ]
  )

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  )
}
