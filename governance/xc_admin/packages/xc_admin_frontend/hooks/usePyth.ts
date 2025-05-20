import {
  AccountType,
  PythCluster,
  getPythProgramKeyForCluster,
  parseBaseData,
} from '@pythnetwork/client'
import { Connection } from '@solana/web3.js'
import { useContext, useEffect, useRef, useState } from 'react'
import { ClusterContext } from '../contexts/ClusterContext'
import { deriveWsUrl, pythClusterApiUrls } from '../utils/pythClusterApiUrl'
import {
  ProgramType,
  getConfig,
  RawConfig,
  MappingRawConfig,
  ProductRawConfig,
  PriceRawConfig,
} from '@pythnetwork/xc-admin-common'

interface PythHookData {
  isLoading: boolean
  rawConfig: RawConfig
  connection?: Connection
}

export const usePyth = (): PythHookData => {
  const connectionRef = useRef<Connection | undefined>(undefined)
  const { cluster } = useContext(ClusterContext)
  const [isLoading, setIsLoading] = useState(true)
  const [rawConfig, setRawConfig] = useState<RawConfig>({ mappingAccounts: [] })
  const [urlsIndex, setUrlsIndex] = useState(0)

  useEffect(() => {
    setIsLoading(true)
  }, [urlsIndex, cluster])

  useEffect(() => {
    setUrlsIndex(0)
  }, [cluster])

  useEffect(() => {
    let cancelled = false
    const urls = pythClusterApiUrls(cluster)
    const connection = new Connection(urls[urlsIndex], {
      commitment: 'confirmed',
      wsEndpoint: deriveWsUrl(urls[urlsIndex]),
    })

    connectionRef.current = connection
    ;(async () => {
      try {
        const allPythAccounts = [
          ...(await connection.getProgramAccounts(
            getPythProgramKeyForCluster(cluster as PythCluster)
          )),
        ]
        if (cancelled) return

        // Use the functional approach to parse the accounts
        const parsedConfig = getConfig[ProgramType.PYTH_CORE]({
          accounts: allPythAccounts,
          cluster: cluster as PythCluster,
        })

        // Get all account pubkeys from the parsed config
        const processedPubkeys = new Set<string>([
          ...parsedConfig.mappingAccounts.map((acc) => acc.address.toBase58()),
          ...parsedConfig.mappingAccounts.flatMap((mapping) =>
            mapping.products.flatMap((prod) => [
              prod.address.toBase58(),
              ...prod.priceAccounts.map((price) => price.address.toBase58()),
            ])
          ),
        ])

        // Find accounts that weren't included in the parsed config
        const unprocessedAccounts = allPythAccounts.filter((account) => {
          const base = parseBaseData(account.account.data)
          // Skip permission accounts entirely
          if (!base || base.type === AccountType.Permission) {
            return false
          }
          return !processedPubkeys.has(account.pubkey.toBase58())
        })

        if (unprocessedAccounts.length > 0) {
          console.warn(
            `${unprocessedAccounts.length} accounts were not processed:`,
            unprocessedAccounts.map((acc) => ({
              pubkey: acc.pubkey.toBase58(),
              type: parseBaseData(acc.account.data)?.type,
            }))
          )
        }

        setRawConfig(parsedConfig as RawConfig)
        setIsLoading(false)
      } catch (e) {
        if (cancelled) return
        if (urlsIndex === urls.length - 1) {
          setIsLoading(false)
          console.warn(`Failed to fetch accounts`)
        } else if (urlsIndex < urls.length - 1) {
          setUrlsIndex((urlsIndex) => urlsIndex + 1)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [urlsIndex, cluster])

  return {
    isLoading,
    connection: connectionRef.current,
    rawConfig,
  }
}

// Re-export the types for compatibility
export type { RawConfig, MappingRawConfig, ProductRawConfig, PriceRawConfig }
