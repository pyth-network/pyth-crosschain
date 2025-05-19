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

        // Verify all accounts were processed
        const remainingAccounts = allPythAccounts.filter((account) => {
          const base = parseBaseData(account.account.data)
          return base && base.type !== AccountType.Test
        })

        if (remainingAccounts.length > 0) {
          console.warn(
            `${remainingAccounts.length} accounts were not processed`
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
