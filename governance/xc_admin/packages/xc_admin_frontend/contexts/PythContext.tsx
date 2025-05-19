import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePyth } from '../hooks/usePyth'
import { RawConfig } from '../hooks/usePyth'
import { Connection } from '@solana/web3.js'
import {
  MappingRawConfig,
  ProductRawConfig,
} from '@pythnetwork/xc-admin-common'

type AccountKeyToSymbol = { [key: string]: string }
interface PythContextProps {
  rawConfig: RawConfig
  dataIsLoading: boolean
  connection?: Connection
  priceAccountKeyToSymbolMapping: AccountKeyToSymbol
  productAccountKeyToSymbolMapping: AccountKeyToSymbol
  publisherKeyToNameMapping: Record<string, Record<string, string>>
  multisigSignerKeyToNameMapping: Record<string, string>
}

const PythContext = createContext<PythContextProps>({
  rawConfig: { mappingAccounts: [] },
  dataIsLoading: true,
  priceAccountKeyToSymbolMapping: {},
  productAccountKeyToSymbolMapping: {},
  publisherKeyToNameMapping: {},
  multisigSignerKeyToNameMapping: {},
})

export const usePythContext = () => useContext(PythContext)

interface PythContextProviderProps {
  children?: React.ReactNode
  publisherKeyToNameMapping: Record<string, Record<string, string>>
  multisigSignerKeyToNameMapping: Record<string, string>
}
export const PythContextProvider: React.FC<PythContextProviderProps> = ({
  children,
  publisherKeyToNameMapping,
  multisigSignerKeyToNameMapping,
}) => {
  const { isLoading, connection, rawConfig } = usePyth()
  const [
    productAccountKeyToSymbolMapping,
    setProductAccountKeyToSymbolMapping,
  ] = useState<AccountKeyToSymbol>({})
  const [priceAccountKeyToSymbolMapping, setPriceAccountKeyToSymbolMapping] =
    useState<AccountKeyToSymbol>({})

  useEffect(() => {
    if (!isLoading) {
      const productAccountMapping: AccountKeyToSymbol = {}
      const priceAccountMapping: AccountKeyToSymbol = {}
      rawConfig.mappingAccounts.map((acc: MappingRawConfig) =>
        acc.products.map((prod: ProductRawConfig) => {
          productAccountMapping[prod.address.toBase58()] = prod.metadata.symbol
          priceAccountMapping[prod.priceAccounts[0].address.toBase58()] =
            prod.metadata.symbol
        })
      )
      setProductAccountKeyToSymbolMapping(productAccountMapping)
      setPriceAccountKeyToSymbolMapping(priceAccountMapping)
    }
  }, [rawConfig, isLoading])

  const value = useMemo(
    () => ({
      rawConfig,
      dataIsLoading: isLoading,
      connection,
      priceAccountKeyToSymbolMapping,
      productAccountKeyToSymbolMapping,
      publisherKeyToNameMapping,
      multisigSignerKeyToNameMapping,
    }),
    [
      rawConfig,
      isLoading,
      connection,
      publisherKeyToNameMapping,
      multisigSignerKeyToNameMapping,
      priceAccountKeyToSymbolMapping,
      productAccountKeyToSymbolMapping,
    ]
  )

  return <PythContext.Provider value={value}>{children}</PythContext.Provider>
}
