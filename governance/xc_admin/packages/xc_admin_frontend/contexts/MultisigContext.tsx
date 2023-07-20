import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import React, { createContext, useContext, useMemo } from 'react'
import { MultisigInstruction } from 'xc_admin_common'
import { useMultisig, MultisigHookData } from '../hooks/useMultisig'

const MultisigContext = createContext<MultisigHookData>({
  upgradeMultisigAccount: undefined,
  priceFeedMultisigAccount: undefined,
  upgradeMultisigProposals: [],
  priceFeedMultisigProposals: [],
  allProposalsIxsParsed: [],
  isLoading: true,
  error: null,
  proposeSquads: undefined,
  voteSquads: undefined,
  refreshData: undefined,
  connection: undefined,
  setpriceFeedMultisigProposals: () => {},
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
    error,
    proposeSquads,
    voteSquads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
    setpriceFeedMultisigProposals,
    refreshData,
    connection,
  } = useMultisig()

  const value = useMemo(
    () => ({
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      allProposalsIxsParsed,
      setpriceFeedMultisigProposals,
      isLoading,
      error,
      proposeSquads,
      voteSquads,
      refreshData,
      connection,
    }),
    [
      proposeSquads,
      voteSquads,
      isLoading,
      error,
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      allProposalsIxsParsed,
      setpriceFeedMultisigProposals,
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
