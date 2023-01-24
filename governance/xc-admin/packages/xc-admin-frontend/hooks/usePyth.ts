import {
  AccountType,
  getPythProgramKeyForCluster,
  parseBaseData,
  parseMappingData,
  parsePermissionData,
  parsePriceData,
  parseProductData,
  PermissionData,
  Product,
} from '@pythnetwork/client'
import { Connection, PublicKey } from '@solana/web3.js'
import assert from 'assert'
import { useContext, useEffect, useRef, useState } from 'react'
import { ClusterContext } from '../contexts/ClusterContext'
import { pythClusterApiUrls } from '../utils/pythClusterApiUrl'

const ONES = '11111111111111111111111111111111'

interface PythHookData {
  isLoading: boolean
  error: any // TODO: fix any
  rawConfig: RawConfig
  connection?: Connection
}

export type RawConfig = {
  mappingAccounts: MappingRawConfig[]
  permissionAccount?: PermissionData
}
export type MappingRawConfig = {
  address: PublicKey
  next: PublicKey | null
  products: ProductRawConfig[]
}
export type ProductRawConfig = {
  address: PublicKey
  priceAccounts: PriceRawConfig[]
  metadata: Product
}
export type PriceRawConfig = {
  next: PublicKey | null
  address: PublicKey
  expo: number
  minPub: number
  publishers: PublicKey[]
}

const usePyth = (): PythHookData => {
  const connectionRef = useRef<Connection>()
  const { cluster } = useContext(ClusterContext)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rawConfig, setRawConfig] = useState<RawConfig>({ mappingAccounts: [] })
  const [urlsIndex, setUrlsIndex] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
  }, [urlsIndex, cluster])

  useEffect(() => {
    let cancelled = false
    const urls = pythClusterApiUrls(cluster)
    const connection = new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })

    connectionRef.current = connection
    ;(async () => {
      try {
        const allPythAccounts = await connection.getProgramAccounts(
          getPythProgramKeyForCluster(cluster)
        )
        if (cancelled) return
        const priceRawConfigs: { [key: string]: PriceRawConfig } = {}

        /// First pass, price accounts
        let i = 0
        while (i < allPythAccounts.length) {
          const base = parseBaseData(allPythAccounts[i].account.data)
          switch (base?.type) {
            case AccountType.Price:
              const parsed = parsePriceData(allPythAccounts[i].account.data)
              priceRawConfigs[allPythAccounts[i].pubkey.toBase58()] = {
                next: parsed.nextPriceAccountKey,
                address: allPythAccounts[i].pubkey,
                publishers: parsed.priceComponents.map((x) => {
                  return x.publisher!
                }),
                expo: parsed.exponent,
                minPub: parsed.minPublishers,
              }
              allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1]
              allPythAccounts.pop()
              break
            default:
              i += 1
          }
        }

        if (cancelled) return
        /// Second pass, product accounts
        i = 0
        const productRawConfigs: { [key: string]: ProductRawConfig } = {}
        while (i < allPythAccounts.length) {
          const base = parseBaseData(allPythAccounts[i].account.data)
          switch (base?.type) {
            case AccountType.Product:
              const parsed = parseProductData(allPythAccounts[i].account.data)

              if (parsed.priceAccountKey.toBase58() == ONES) {
                productRawConfigs[allPythAccounts[i].pubkey.toBase58()] = {
                  priceAccounts: [],
                  metadata: parsed.product,
                  address: allPythAccounts[i].pubkey,
                }
              } else {
                let priceAccountKey: string | null =
                  parsed.priceAccountKey.toBase58()
                let priceAccounts = []
                while (priceAccountKey) {
                  const toAdd: PriceRawConfig = priceRawConfigs[priceAccountKey]
                  priceAccounts.push(toAdd)
                  delete priceRawConfigs[priceAccountKey]
                  priceAccountKey = toAdd.next ? toAdd.next.toBase58() : null
                }
                productRawConfigs[allPythAccounts[i].pubkey.toBase58()] = {
                  priceAccounts,
                  metadata: parsed.product,
                  address: allPythAccounts[i].pubkey,
                }
              }
              allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1]
              allPythAccounts.pop()
              break
            default:
              i += 1
          }
        }

        const rawConfig: RawConfig = { mappingAccounts: [] }
        if (cancelled) return
        /// Third pass, mapping accounts
        i = 0
        while (i < allPythAccounts.length) {
          const base = parseBaseData(allPythAccounts[i].account.data)
          switch (base?.type) {
            case AccountType.Mapping:
              const parsed = parseMappingData(allPythAccounts[i].account.data)
              rawConfig.mappingAccounts.push({
                next: parsed.nextMappingAccount,
                address: allPythAccounts[i].pubkey,
                products: parsed.productAccountKeys.map((key) => {
                  const toAdd = productRawConfigs[key.toBase58()]
                  delete productRawConfigs[key.toBase58()]
                  return toAdd
                }),
              })
              allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1]
              allPythAccounts.pop()
              break
            case AccountType.Permission:
              rawConfig.permissionAccount = parsePermissionData(
                allPythAccounts[i].account.data
              )
              allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1]
              allPythAccounts.pop()
              break
            default:
              i += 1
          }
        }

        assert(
          allPythAccounts.every(
            (x) =>
              !parseBaseData(x.account.data) ||
              parseBaseData(x.account.data)?.type == AccountType.Test
          )
        )

        setRawConfig(rawConfig)
        setIsLoading(false)
      } catch (e) {
        if (cancelled) return
        if (urlsIndex === urls.length - 1) {
          // @ts-ignore
          setError(e)
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
    error,
    connection: connectionRef.current,
    rawConfig,
  }
}

export default usePyth
