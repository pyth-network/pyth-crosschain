import { Wallet } from '@coral-xyz/anchor'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import {
  AccountMeta,
  Cluster,
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useContext, useEffect, useState } from 'react'
import {
  getManyProposalsInstructions,
  getMultisigCluster,
  getProposals,
  isRemoteCluster,
  MultisigInstruction,
  MultisigParser,
  PRICE_FEED_MULTISIG,
  PythMultisigInstruction,
  UnrecognizedProgram,
  UPGRADE_MULTISIG,
  WormholeMultisigInstruction,
} from 'xc_admin_common'
import { ClusterContext } from '../contexts/ClusterContext'
import { pythClusterApiUrls } from '../utils/pythClusterApiUrl'

interface MultisigHookData {
  isLoading: boolean
  error: any // TODO: fix any
  proposeSquads: SquadsMesh | undefined
  voteSquads: SquadsMesh | undefined
  upgradeMultisigAccount: MultisigAccount | undefined
  priceFeedMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  priceFeedMultisigProposals: TransactionAccount[]
  allProposalsIxsParsed: MultisigInstruction[][]
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

export const useMultisig = (wallet: Wallet): MultisigHookData => {
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
  const [proposeSquads, setProposeSquads] = useState<SquadsMesh>()
  const [voteSquads, setVoteSquads] = useState<SquadsMesh>()
  const anchorWallet = useAnchorWallet()

  const [urlsIndex, setUrlsIndex] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
  }, [urlsIndex, cluster])

  useEffect(() => {
    setUrlsIndex(0)
  }, [cluster])

  useEffect(() => {
    const urls = pythClusterApiUrls(getMultisigCluster(cluster))
    const connection = new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })
    if (wallet) {
      setProposeSquads(
        new SquadsMesh({
          connection,
          wallet,
        })
      )
    }
    if (anchorWallet) {
      setVoteSquads(
        new SquadsMesh({
          connection,
          wallet: anchorWallet as Wallet,
        })
      )
    }
  }, [wallet, urlsIndex, cluster, anchorWallet])

  useEffect(() => {
    let cancelled = false
    const urls = pythClusterApiUrls(getMultisigCluster(cluster))
    const connection = new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })

    ;(async () => {
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
          // DELETE THIS TRY CATCH ONCE THIS MULTISIG EXISTS EVERYWHERE
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
        setUpgradeMultisigProposals(
          await getSortedProposals(
            readOnlySquads,
            UPGRADE_MULTISIG[getMultisigCluster(cluster)]
          )
        )
        try {
          if (cancelled) return
          // DELETE THIS TRY CATCH ONCE THIS MULTISIG EXISTS EVERYWHERE
          const sortedPriceFeedMultisigProposals = await getSortedProposals(
            readOnlySquads,
            PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
          )
          const allProposalsIxs = await getManyProposalsInstructions(
            readOnlySquads,
            sortedPriceFeedMultisigProposals
          )
          const multisigParser = MultisigParser.fromCluster(
            getMultisigCluster(cluster)
          )
          const parsedAllProposalsIxs = allProposalsIxs.map((ixs) =>
            ixs.map((ix) =>
              multisigParser.parseInstruction({
                programId: ix.programId,
                data: ix.data as Buffer,
                keys: ix.keys as AccountMeta[],
              })
            )
          )
          const proposalsRes: TransactionAccount[] = []
          const instructionsRes: MultisigInstruction[][] = []
          // filter proposals for respective devnet/pythtest and mainnet-beta/pythnet clusters
          parsedAllProposalsIxs.map((ixs, idx) => {
            // pythtest/pythnet proposals
            if (
              isRemoteCluster(cluster) &&
              ixs.length > 0 &&
              ixs.some((ix) => ix instanceof WormholeMultisigInstruction)
            ) {
              proposalsRes.push(sortedPriceFeedMultisigProposals[idx])
              instructionsRes.push(ixs)
            }
            // devnet/testnet/mainnet-beta proposals
            if (
              !isRemoteCluster(cluster) &&
              (ixs.length === 0 ||
                ixs.some((ix) => ix instanceof PythMultisigInstruction) ||
                ixs.some((ix) => ix instanceof UnrecognizedProgram))
            ) {
              proposalsRes.push(sortedPriceFeedMultisigProposals[idx])
              instructionsRes.push(ixs)
            }
          })
          setAllProposalsIxsParsed(instructionsRes)
          setpriceFeedMultisigProposals(proposalsRes)
        } catch (e) {
          console.error(e)
          setAllProposalsIxsParsed([])
          setpriceFeedMultisigProposals([])
        }

        setIsLoading(false)
      } catch (e) {
        console.log(e)
        if (cancelled) return
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
    })()

    return () => {
      cancelled = true
    }
  }, [urlsIndex, cluster])

  return {
    isLoading,
    error,
    proposeSquads,
    voteSquads,
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    upgradeMultisigProposals,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
    setpriceFeedMultisigProposals,
  }
}
