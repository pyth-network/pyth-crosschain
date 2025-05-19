import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  PRICE_FEED_MULTISIG,
  UPGRADE_MULTISIG,
  getMultisigCluster,
  getProposals,
} from '@pythnetwork/xc-admin-common'
import { ClusterContext } from '../contexts/ClusterContext'
import { deriveWsUrl, pythClusterApiUrls } from '../utils/pythClusterApiUrl'

export interface MultisigHookData {
  isLoading: boolean
  walletSquads: SquadsMesh | undefined
  readOnlySquads: SquadsMesh
  upgradeMultisigAccount: MultisigAccount | undefined
  priceFeedMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  priceFeedMultisigProposals: TransactionAccount[]
  connection: Connection
  refreshData?: () => { fetchData: () => Promise<void>; cancel: () => void }
}

const getSortedProposals = async (
  readOnlySquads: SquadsMesh,
  vault: PublicKey
): Promise<TransactionAccount[]> => {
  const proposals = await getProposals(readOnlySquads, vault)
  return proposals.sort((a, b) => b.transactionIndex - a.transactionIndex)
}

export const useMultisig = (): MultisigHookData => {
  const wallet = useAnchorWallet()
  const { cluster } = useContext(ClusterContext)
  const [isLoading, setIsLoading] = useState(true)
  const [upgradeMultisigAccount, setUpgradeMultisigAccount] =
    useState<MultisigAccount>()
  const [priceFeedMultisigAccount, setPriceFeedMultisigAccount] =
    useState<MultisigAccount>()
  const [upgradeMultisigProposals, setUpgradeMultisigProposals] = useState<
    TransactionAccount[]
  >([])
  const [priceFeedMultisigProposals, setPriceFeedMultisigProposals] = useState<
    TransactionAccount[]
  >([])

  const [urlsIndex, setUrlsIndex] = useState(0)

  useEffect(() => {
    setUrlsIndex(0)
  }, [cluster])

  const multisigCluster = useMemo(() => getMultisigCluster(cluster), [cluster])

  const connection = useMemo(() => {
    const urls = pythClusterApiUrls(multisigCluster)
    return new Connection(urls[urlsIndex], {
      commitment: 'confirmed',
      wsEndpoint: deriveWsUrl(urls[urlsIndex]),
    })
  }, [urlsIndex, multisigCluster])

  const readOnlySquads = useMemo(() => {
    return new SquadsMesh({
      connection,
      wallet: new NodeWallet(new Keypair()),
    })
  }, [connection])

  const walletSquads = useMemo(() => {
    if (!wallet) return undefined
    return new SquadsMesh({
      connection,
      wallet,
    })
  }, [connection, wallet])

  const refreshData = useCallback(() => {
    let cancelled = false

    const fetchData = async () => {
      setIsLoading(true)
      try {
        if (cancelled) return
        const upgradeMultisigAccount = await readOnlySquads.getMultisig(
          UPGRADE_MULTISIG[multisigCluster]
        )

        if (cancelled) return
        const priceFeedMultisigAccount = await readOnlySquads.getMultisig(
          PRICE_FEED_MULTISIG[multisigCluster]
        )

        if (cancelled) return
        const upgradeProposals = await getSortedProposals(
          readOnlySquads,
          UPGRADE_MULTISIG[multisigCluster]
        )

        if (cancelled) return
        const sortedPriceFeedMultisigProposals = await getSortedProposals(
          readOnlySquads,
          PRICE_FEED_MULTISIG[multisigCluster]
        )

        setUpgradeMultisigAccount(upgradeMultisigAccount)
        setPriceFeedMultisigAccount(priceFeedMultisigAccount)
        setUpgradeMultisigProposals(upgradeProposals)
        setPriceFeedMultisigProposals(sortedPriceFeedMultisigProposals)

        setIsLoading(false)
      } catch (e) {
        console.log(e)
        if (cancelled) return
        const urls = pythClusterApiUrls(multisigCluster)
        if (urlsIndex === urls.length - 1) {
          setIsLoading(false)
          console.warn(`Failed to fetch accounts`)
        } else if (urlsIndex < urls.length - 1) {
          setUrlsIndex((urlsIndex) => urlsIndex + 1)
          console.warn(
            `Failed with ${urls[urlsIndex]}, trying with ${urls[urlsIndex + 1]}`
          )
        }
      }
    }
    const cancel = () => {
      cancelled = true
    }

    return { cancel, fetchData }
  }, [readOnlySquads, multisigCluster, urlsIndex])

  useEffect(() => {
    const { cancel, fetchData } = refreshData()
    fetchData()
    return cancel
  }, [refreshData])

  return {
    isLoading,
    walletSquads,
    readOnlySquads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    refreshData,
    connection,
  }
}
