import { Wallet } from '@coral-xyz/anchor'
import { Cluster, Connection, PublicKey, Transaction } from '@solana/web3.js'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useContext, useEffect, useRef, useState } from 'react'
import { getMultisigCluster, getProposals } from 'xc_admin_common'
import { ClusterContext } from '../contexts/ClusterContext'
import { pythClusterApiUrls } from '../utils/pythClusterApiUrl'

export const UPGRADE_MULTISIG: Record<Cluster | 'localnet', PublicKey> = {
  'mainnet-beta': new PublicKey('FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj'),
  testnet: new PublicKey('FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj'),
  devnet: new PublicKey('6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3'),
  localnet: new PublicKey('FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj'),
}

export const SECURITY_MULTISIG: Record<Cluster | 'localnet', PublicKey> = {
  'mainnet-beta': new PublicKey('92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8'), // TODO: placeholder value for now, fix when vault is created
  testnet: new PublicKey('92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8'), // TODO: placeholder value for now, fix when vault is created
  devnet: new PublicKey('92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8'),
  localnet: new PublicKey('92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8'), // TODO: placeholder value for now, fix when vault is created
}

interface MultisigHookData {
  isLoading: boolean
  error: any // TODO: fix any
  squads: SquadsMesh | undefined
  upgradeMultisigAccount: MultisigAccount | undefined
  securityMultisigAccount: MultisigAccount | undefined
  upgradeMultisigProposals: TransactionAccount[]
  securityMultisigProposals: TransactionAccount[]
}

const getSortedProposals = async (
  squads: SquadsMesh,
  vault: PublicKey
): Promise<TransactionAccount[]> => {
  const proposals = await getProposals(squads, vault)
  return proposals.sort((a, b) => b.transactionIndex - a.transactionIndex)
}

export const useMultisig = (wallet: Wallet): MultisigHookData => {
  const connectionRef = useRef<Connection>()
  const { cluster } = useContext(ClusterContext)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [upgradeMultisigAccount, setUpgradeMultisigAccount] =
    useState<MultisigAccount>()
  const [securityMultisigAccount, setSecurityMultisigAccount] =
    useState<MultisigAccount>()
  const [upgradeMultisigProposals, setUpgradeMultisigProposals] = useState<
    TransactionAccount[]
  >([])
  const [securityMultisigProposals, setSecurityMultisigProposals] = useState<
    TransactionAccount[]
  >([])
  const [squads, setSquads] = useState<SquadsMesh>()
  const [urlsIndex, setUrlsIndex] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
  }, [urlsIndex, cluster])

  useEffect(() => {
    let cancelled = false
    const urls = pythClusterApiUrls(getMultisigCluster(cluster))
    const connection = new Connection(urls[urlsIndex].rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: urls[urlsIndex].wsUrl,
    })

    connectionRef.current = connection
    ;(async () => {
      try {
        // mock wallet to allow users to view proposals without connecting their wallet
        const signTransaction = () =>
          new Promise<Transaction>((resolve) => {
            resolve(new Transaction())
          })
        const signAllTransactions = () =>
          new Promise<Transaction[]>((resolve) => {
            resolve([new Transaction()])
          })
        const squads = wallet
          ? new SquadsMesh({
              connection,
              wallet,
            })
          : new SquadsMesh({
              connection,
              wallet: {
                signTransaction: () => signTransaction(),
                signAllTransactions: () => signAllTransactions(),
                publicKey: new PublicKey(0),
              },
            })
        if (cancelled) return
        setUpgradeMultisigAccount(
          await squads.getMultisig(
            UPGRADE_MULTISIG[getMultisigCluster(cluster)]
          )
        )
        if (cluster === 'devnet') {
          setSecurityMultisigAccount(
            await squads.getMultisig(
              SECURITY_MULTISIG[getMultisigCluster(cluster)]
            )
          )
        } else {
          setSecurityMultisigAccount(undefined)
        }
        if (cancelled) return
        setUpgradeMultisigProposals(
          await getSortedProposals(
            squads,
            UPGRADE_MULTISIG[getMultisigCluster(cluster)]
          )
        )
        if (cluster === 'devnet') {
          setSecurityMultisigProposals(
            await getSortedProposals(
              squads,
              SECURITY_MULTISIG[getMultisigCluster(cluster)]
            )
          )
        } else {
          setSecurityMultisigProposals([])
        }
        setSquads(squads)
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
  }, [urlsIndex, cluster, wallet])

  return {
    isLoading,
    error,
    squads,
    upgradeMultisigAccount,
    securityMultisigAccount,
    upgradeMultisigProposals,
    securityMultisigProposals,
  }
}
