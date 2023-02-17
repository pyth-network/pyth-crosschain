import { Wallet } from '@coral-xyz/anchor'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import React, { createContext, useContext, useMemo } from 'react'
import { MultisigInstruction } from 'xc_admin_common'
import { useMultisig } from '../hooks/useMultisig'

// TODO: fix any
interface MultisigContextProps {
  isLoading: boolean
  error: any // TODO: fix any
  squads: SquadsMesh | undefined
  upgradeMultisigAccount: MultisigAccount | undefined
  priceFeedMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  priceFeedMultisigProposals: TransactionAccount[]
  allProposalsIxsParsed: MultisigInstruction[][]
}

const MultisigContext = createContext<MultisigContextProps>({
  upgradeMultisigAccount: undefined,
  priceFeedMultisigAccount: undefined,
  upgradeMultisigProposals: [],
  priceFeedMultisigProposals: [],
  allProposalsIxsParsed: [],
  isLoading: true,
  error: null,
  squads: undefined,
})

export const useMultisigContext = () => useContext(MultisigContext)

interface MultisigContextProviderProps {
  children?: React.ReactNode
}

export const MultisigContextProvider: React.FC<
  MultisigContextProviderProps
> = ({ children }) => {
  const anchorWallet = useAnchorWallet()
  const {
    isLoading,
    error,
    squads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
  } = useMultisig(anchorWallet as Wallet)

  const value = useMemo(
    () => ({
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      allProposalsIxsParsed,
      isLoading,
      error,
      squads,
    }),
    [
      squads,
      isLoading,
      error,
      upgradeMultisigAccount,
      priceFeedMultisigAccount,
      upgradeMultisigProposals,
      priceFeedMultisigProposals,
      allProposalsIxsParsed,
    ]
  )

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  )
}
