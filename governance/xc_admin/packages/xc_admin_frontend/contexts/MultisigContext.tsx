import { Wallet } from '@coral-xyz/anchor'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import React, { createContext, useContext, useMemo } from 'react'
import { useMultisig } from '../hooks/useMultisig'

// TODO: fix any
interface MultisigContextProps {
  isLoading: boolean
  error: any // TODO: fix any
  squads: SquadsMesh | undefined
  upgradeMultisigAccount: MultisigAccount | undefined
  securityMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  securityMultisigProposals: TransactionAccount[]
}

const MultisigContext = createContext<MultisigContextProps>({
  upgradeMultisigAccount: undefined,
  securityMultisigAccount: undefined,
  upgradeMultisigProposals: [],
  securityMultisigProposals: [],
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
    securityMultisigAccount,
    upgradeMultisigProposals,
    securityMultisigProposals,
  } = useMultisig(anchorWallet as Wallet)

  const value = useMemo(
    () => ({
      upgradeMultisigAccount,
      securityMultisigAccount,
      upgradeMultisigProposals,
      securityMultisigProposals,
      isLoading,
      error,
      squads,
    }),
    [
      squads,
      isLoading,
      error,
      upgradeMultisigAccount,
      securityMultisigAccount,
      upgradeMultisigProposals,
      securityMultisigProposals,
    ]
  )

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  )
}
