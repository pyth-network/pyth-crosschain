import {
  parseMappingData,
  parsePriceData,
  parseProductData,
  PriceData,
  ProductData,
} from '@pythnetwork/client'
import { AccountInfo, Commitment, Connection, PublicKey } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { SetStateAction, useContext, useEffect, useRef, useState } from 'react'
import { ClusterContext } from '../contexts/ClusterContext'
import { pythClusterApiUrls } from '../utils/pythClusterApiUrl'

const ONES = '11111111111111111111111111111111'

function chunks<T>(array: T[], size: number): T[][] {
  return Array.apply(0, new Array(Math.ceil(array.length / size))).map(
    (_, index) => array.slice(index * size, (index + 1) * size)
  )
}

const getMultipleAccountsCore = async (
  connection: Connection,
  keys: string[],
  commitment: string
) => {
  //keys are initially base58 encoded
  const pubkeyTransform = keys.map((x) => new PublicKey(x))
  const resultArray = await connection.getMultipleAccountsInfo(
    pubkeyTransform,
    commitment as Commitment
  )

  return { keys, array: resultArray }
}

const getMultipleAccounts = async (
  connection: Connection,
  keys: string[],
  commitment: string
) => {
  const result = await Promise.all(
    chunks(keys, 99).map((chunk) =>
      getMultipleAccountsCore(connection, chunk, commitment)
    )
  )

  const array = result
    .map(
      (a) =>
        a.array
          .map((acc) => {
            if (!acc) {
              return undefined
            } else {
              return acc
            }
          })
          .filter((_) => _) as AccountInfo<Buffer>[]
    )
    .flat()
  return { keys, array }
}

export const ORACLE_PUBLIC_KEYS = {
  devnet: 'BmA9Z6FjioHJPpjT39QazZyhDRUdZy2ezwx4GiDdE2u2',
  testnet: 'AFmdnt9ng1uVxqCmqwQJDAYC5cKTkw8gJKSM5PnzuF6z',
  'mainnet-beta': 'AHtgzX45WTKfkPG53L6WYhGEXwQkN1BVknET3sVsLL8J',
  pythtest: 'AFmdnt9ng1uVxqCmqwQJDAYC5cKTkw8gJKSM5PnzuF6z',
  pythnet: 'AHtgzX45WTKfkPG53L6WYhGEXwQkN1BVknET3sVsLL8J',
}

export const BAD_SYMBOLS = [undefined]

const createSetSymbolMapUpdater =
  (
    symbol: string | number,
    product: ProductData,
    price: PriceData,
    productAccountKey: any,
    priceAccountKey: any
  ) =>
  (prev: { [x: string]: { price: { [x: string]: number } } }) =>
    !prev[symbol] || prev[symbol].price['validSlot'] < price.validSlot
      ? {
          ...prev,
          [symbol]: {
            product,
            price,
            productAccountKey,
            priceAccountKey,
          },
        }
      : prev

const handlePriceInfo = (
  symbol: string,
  product: ProductData,
  accountInfo: {
    executable?: boolean
    owner?: PublicKey
    lamports?: number
    data: Buffer
    rentEpoch?: number | undefined
  },
  setSymbolMap: {
    (value: SetStateAction<{}>): void
    (value: SetStateAction<{}>): void
    (
      arg0: (prev: { [x: string]: { price: { [x: string]: number } } }) => {
        [x: string]:
          | { price: { [x: string]: number } }
          | {
              product: ProductData
              price: PriceData
              productAccountKey: number
              priceAccountKey: number
            }
      }
    ): void
  },
  productAccountKey: string,
  priceAccountKey: PublicKey,
  setPriceAccounts: {
    (value: SetStateAction<{}>): void
    (value: SetStateAction<{}>): void
    (arg0: (o: any) => any): void
  }
) => {
  if (!accountInfo || !accountInfo.data) return
  const price = parsePriceData(accountInfo.data)
  setPriceAccounts((o) => ({
    ...o,
    [priceAccountKey.toString()]: {
      isLoading: false,
      error: null,
      price,
    },
  }))
  if (price.priceType !== 1)
    console.log(symbol, price.priceType, price.nextPriceAccountKey!.toString)
  setSymbolMap(
    createSetSymbolMapUpdater(
      symbol,
      product,
      price,
      productAccountKey,
      priceAccountKey
    )
  )
}

interface IProductAccount {
  isLoading: boolean
  error: any // TODO: fix any
  product: any // TODO: fix any
}

interface PythHookData {
  isLoading: boolean
  error: any // TODO: fix any
  version: number | null
  numProducts: number
  productAccounts: { [key: string]: IProductAccount }
  priceAccounts: any // TODO: fix any
  symbolMap: any // TODO: fix any
  connection?: Connection
}

const usePyth = (
  symbolFilter?: Array<String>,
  subscribe = true
): PythHookData => {
  const connectionRef = useRef<Connection>()
  const { cluster } = useContext(ClusterContext)
  const oraclePublicKey = ORACLE_PUBLIC_KEYS[cluster]
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState<number | null>(null)
  const [urlsIndex, setUrlsIndex] = useState(0)
  const [numProducts, setNumProducts] = useState(0)
  const [productAccounts, setProductAccounts] = useState({})
  const [priceAccounts, setPriceAccounts] = useState({})
  const [symbolMap, setSymbolMap] = useState({})

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setVersion(null)
    setNumProducts(0)
    setProductAccounts({})
    setPriceAccounts({})
    setSymbolMap({})
  }, [urlsIndex, oraclePublicKey, cluster])

  useEffect(() => {
    let cancelled = false
    const subscriptionIds: number[] = []
    const urls = pythClusterApiUrls(cluster)
    const connection = new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })

    connectionRef.current = connection
    ;(async () => {
      // read mapping account
      const publicKey = new PublicKey(oraclePublicKey)
      try {
        const accountInfo = await connection.getAccountInfo(publicKey)
        if (cancelled) return
        if (!accountInfo || !accountInfo.data) {
          setIsLoading(false)
          return
        }
        const { productAccountKeys, version, nextMappingAccount } =
          parseMappingData(accountInfo.data)
        let allProductAccountKeys = [...productAccountKeys]
        let anotherMappingAccount = nextMappingAccount
        while (anotherMappingAccount) {
          const accountInfo = await connection.getAccountInfo(
            anotherMappingAccount
          )
          if (cancelled) return
          if (!accountInfo || !accountInfo.data) {
            anotherMappingAccount = null
          } else {
            const { productAccountKeys, nextMappingAccount } = parseMappingData(
              accountInfo.data
            )
            allProductAccountKeys = [
              ...allProductAccountKeys,
              ...productAccountKeys,
            ]
            anotherMappingAccount = nextMappingAccount
          }
        }
        setIsLoading(false)
        setVersion(version)
        setNumProducts(allProductAccountKeys.length)
        setProductAccounts(
          allProductAccountKeys.reduce((o, p) => {
            // @ts-ignore
            o[p.toString()] = { isLoading: true, error: null, product: null }
            return o
          }, {})
        )
        const productsInfos = await getMultipleAccounts(
          connection,
          allProductAccountKeys.map((p) => p.toBase58()),
          'confirmed'
        )
        if (cancelled) return
        const productsData = productsInfos.array.map((p) =>
          parseProductData(p.data)
        )
        const priceInfos = await getMultipleAccounts(
          connection,
          productsData
            .filter((x) => x.priceAccountKey.toString() !== ONES)
            .map((p) => p.priceAccountKey.toBase58()),
          'confirmed'
        )
        if (cancelled) return

        for (let i = 0; i < productsInfos.keys.length; i++) {
          const productAccountKey = productsInfos.keys[i]
          const product = productsData[i]
          const symbol = product.product.symbol
          const priceAccountKey = product.priceAccountKey
          const priceInfo = priceInfos.array[i]

          setProductAccounts((o) => ({
            ...o,
            [productAccountKey.toString()]: {
              isLoading: false,
              error: null,
              product,
            },
          }))
          if (
            priceAccountKey.toString() !== ONES &&
            (!symbolFilter || symbolFilter.includes(symbol)) &&
            // @ts-ignore
            !BAD_SYMBOLS.includes(symbol)
          ) {
            // TODO: we can add product info here and update the price later
            setPriceAccounts((o) => ({
              ...o,
              [priceAccountKey.toString()]: {
                isLoading: true,
                error: null,
                price: null,
              },
            }))
            handlePriceInfo(
              symbol,
              product,
              priceInfo,
              setSymbolMap,
              productAccountKey,
              priceAccountKey,
              setPriceAccounts
            )
            if (subscribe) {
              subscriptionIds.push(
                connection.onAccountChange(priceAccountKey, (accountInfo) => {
                  if (cancelled) return
                  handlePriceInfo(
                    symbol,
                    product,
                    accountInfo,
                    setSymbolMap,
                    productAccountKey,
                    priceAccountKey,
                    setPriceAccounts
                  )
                })
              )
            }
          }
        }

        setIsLoading(false)
      } catch (e) {
        if (cancelled) return
        if (urlsIndex === urls.length - 1) {
          // @ts-ignore
          setError(e)
          setIsLoading(false)
          console.warn(
            `Failed to fetch mapping info for ${publicKey.toString()}`
          )
        } else if (urlsIndex < urls.length - 1) {
          setUrlsIndex((urlsIndex) => urlsIndex + 1)
        }
      }
    })()

    return () => {
      cancelled = true
      for (const subscriptionId of subscriptionIds) {
        connection.removeAccountChangeListener(subscriptionId).catch(() => {
          console.warn(
            `Unsuccessfully attempted to remove listener for subscription id ${subscriptionId}`
          )
        })
      }
    }
  }, [symbolFilter, urlsIndex, oraclePublicKey, cluster, subscribe])

  return {
    isLoading,
    error,
    version,
    numProducts,
    productAccounts,
    priceAccounts,
    symbolMap,
    connection: connectionRef.current,
  }
}

export default usePyth
