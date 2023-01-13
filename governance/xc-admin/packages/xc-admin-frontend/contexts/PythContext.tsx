import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import usePyth from '../hooks/usePyth'
import { PythData } from '../types'

// TODO: fix any
interface PythContextProps {
  data: PythData
  dataIsLoading: boolean
  error: any
  connection: any
}

const PythContext = createContext<PythContextProps>({
  data: {},
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
  symbols,
  raw,
}) => {
  const { symbolMap, isLoading, error, connection } = usePyth(symbols)
  const [debouncedSymbolMap, { flush: flushSymbolMap }] = useDebounce(
    symbolMap,
    500,
    { maxWait: 500 }
  )
  const data = raw ? symbolMap : debouncedSymbolMap

  useEffect(() => {
    if (Object.keys(symbolMap).length == 0) flushSymbolMap()
  }, [symbolMap, flushSymbolMap])

  // const {
  //   data: historicalData,
  //   loading: historicalLoading,
  //   error: historicalError,
  // } = useHistoricalData()

  const value = useMemo(
    () => ({
      data,
      dataIsLoading: isLoading,
      error,
      connection,
    }),
    [data, isLoading, error, connection]
  )

  return <PythContext.Provider value={value}>{children}</PythContext.Provider>
}
