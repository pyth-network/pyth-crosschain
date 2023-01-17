import SquadsMesh from '@sqds/mesh'
import { TransactionAccount } from '@sqds/mesh/lib/types'
import React, { createContext, useContext, useMemo } from 'react'
import { useMultisig } from '../hooks/useMultisig'

// TODO: fix any
interface MultisigContextProps {
  isLoading: boolean
  error: any // TODO: fix any
  squads: SquadsMesh | undefined
  proposals: TransactionAccount[]
}

const MultisigContext = createContext<MultisigContextProps>({
  proposals: [],
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
  const { isLoading, error, squads, proposals } = useMultisig()

  const value = useMemo(
    () => ({
      proposals,
      isLoading,
      error,
      squads,
    }),
    [squads, isLoading, error, proposals]
  )

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  )
}
