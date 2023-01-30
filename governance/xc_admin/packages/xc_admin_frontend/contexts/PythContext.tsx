import React, { createContext, useContext, useMemo } from 'react'
import usePyth from '../hooks/usePyth'
import { RawConfig } from '../hooks/usePyth'

// TODO: fix any
interface PythContextProps {
  rawConfig: RawConfig
  dataIsLoading: boolean
  error: any
  connection: any
}

const PythContext = createContext<PythContextProps>({
  rawConfig: { mappingAccounts: [] },
  dataIsLoading: true,
  error: null,
  connection: null,
})

export const usePythContext = () => useContext(PythContext)

interface PythContextProviderProps {
  children?: React.ReactNode
  symbols?: string[]
  raw?: boolean
}

export const PythContextProvider: React.FC<PythContextProviderProps> = ({
  children,
}) => {
  const { isLoading, error, connection, rawConfig } = usePyth()

  const value = useMemo(
    () => ({
      rawConfig,
      dataIsLoading: isLoading,
      error,
      connection,
    }),
    [rawConfig, isLoading, error, connection]
  )

  return <PythContext.Provider value={value}>{children}</PythContext.Provider>
}
