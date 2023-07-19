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
  proposeSquads: SquadsMesh | undefined
  voteSquads: SquadsMesh | undefined
  upgradeMultisigAccount: MultisigAccount | undefined
  priceFeedMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  priceFeedMultisigProposals: TransactionAccount[]
  allProposalsIxsParsed: MultisigInstruction[][]
  connection?: Connection
  refreshData?: () => { fetchData: () => Promise<void>; cancel: () => void }
  setpriceFeedMultisigProposals: React.Dispatch<
    React.SetStateAction<TransactionAccount[]>
  >
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
  const [priceFeedMultisigAccount, setpriceFeedMultisigAccount] =
    useState<MultisigAccount>()
  const [upgradeMultisigProposals, setUpgradeMultisigProposals] = useState<
    TransactionAccount[]
  >([])
  const [priceFeedMultisigProposals, setpriceFeedMultisigProposals] = useState<
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

  const connection = useMemo(() => {
    const urls = pythClusterApiUrls(getMultisigCluster(cluster))
    return new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })
  }, [urlsIndex, cluster])

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
        setUpgradeMultisigAccount(
          await readOnlySquads.getMultisig(
            UPGRADE_MULTISIG[getMultisigCluster(cluster)]
          )
        )
        try {
          if (cancelled) return
          setpriceFeedMultisigAccount(
            await readOnlySquads.getMultisig(
              PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
            )
          )
        } catch (e) {
          console.error(e)
          setpriceFeedMultisigAccount(undefined)
        }

        if (cancelled) return
        const upgradeProposals = await getSortedProposals(
          readOnlySquads,
          UPGRADE_MULTISIG[getMultisigCluster(cluster)]
        )
        setUpgradeMultisigProposals(upgradeProposals)
        try {
          if (cancelled) return
          const sortedPriceFeedMultisigProposals = await getSortedProposals(
            readOnlySquads,
            PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
          )
          setpriceFeedMultisigProposals(sortedPriceFeedMultisigProposals)
        } catch (e) {
          console.error(e)
          setAllProposalsIxsParsed([])
          setpriceFeedMultisigProposals([])
        }

        setIsLoading(false)
      } catch (e) {
        console.log(e)
        if (cancelled) return
        const urls = pythClusterApiUrls(getMultisigCluster(cluster))
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
  }, [cluster, urlsIndex, connection])

  useEffect(() => {
    const { cancel, fetchData } = refreshData()
    fetchData()
    return cancel
  }, [refreshData])

  return {
    isLoading,
    error,
    proposeSquads: squads,
    voteSquads: squads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
    refreshData,
    connection,
    setpriceFeedMultisigProposals,
  }
}
