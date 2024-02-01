import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  getMultisigCluster,
  getProposals,
  MultisigInstruction,
  PRICE_FEED_MULTISIG,
  UPGRADE_MULTISIG,
} from 'xc_admin_common'
import { ClusterContext } from '../contexts/ClusterContext'
import { pythClusterApiUrls } from '../utils/pythClusterApiUrl'

export interface MultisigHookData {
  isLoading: boolean
  error: any // TODO: fix any
  squads: SquadsMesh | undefined
  upgradeMultisigAccount: MultisigAccount | undefined
  priceFeedMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  priceFeedMultisigProposals: TransactionAccount[]
  allProposalsIxsParsed: MultisigInstruction[][]
  connection?: Connection
  refreshData?: () => { fetchData: () => Promise<void>; cancel: () => void }
}

const getSortedProposals = async (
  squads: SquadsMesh,
  vault: PublicKey
): Promise<TransactionAccount[]> => {
  const proposals = await getProposals(squads, vault)
  return proposals.sort((a, b) => b.transactionIndex - a.transactionIndex)
}

export const useMultisig = (): MultisigHookData => {
  const wallet = useAnchorWallet()
  const { cluster } = useContext(ClusterContext)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
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
  const [allProposalsIxsParsed, setAllProposalsIxsParsed] = useState<
    MultisigInstruction[][]
  >([])
  const [squads, setSquads] = useState<SquadsMesh | undefined>()

  const [urlsIndex, setUrlsIndex] = useState(0)

  useEffect(() => {
    setError(null)
  }, [urlsIndex, cluster])

  useEffect(() => {
    setUrlsIndex(0)
  }, [cluster])

  const multisigCluster = useMemo(() => getMultisigCluster(cluster), [cluster])

  const connection = useMemo(() => {
    const urls = pythClusterApiUrls(multisigCluster)
    return new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })
  }, [urlsIndex, multisigCluster])

  useEffect(() => {
    if (wallet) {
      setSquads(
        new SquadsMesh({
          connection,
          wallet,
        })
      )
    } else {
      setSquads(undefined)
    }
  }, [wallet, urlsIndex, cluster, connection])

  const refreshData = useCallback(() => {
    let cancelled = false

    const fetchData = async () => {
      setIsLoading(true)
      try {
        // mock wallet to allow users to view proposals without connecting their wallet
        const readOnlySquads = new SquadsMesh({
          connection,
          wallet: new NodeWallet(new Keypair()),
        })
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
          // @ts-ignore
          setError(e)
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
  }, [multisigCluster, urlsIndex, connection])

  useEffect(() => {
    const { cancel, fetchData } = refreshData()
    fetchData()
    return cancel
  }, [refreshData])

  return {
    isLoading,
    error,
    squads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
    refreshData,
    connection,
  }
}
