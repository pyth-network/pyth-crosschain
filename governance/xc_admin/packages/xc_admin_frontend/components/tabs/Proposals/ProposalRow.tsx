import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getMultisigCluster } from '@pythnetwork/xc-admin-common'
import { ClusterContext } from '../../../contexts/ClusterContext'
import { useMultisigContext } from '../../../contexts/MultisigContext'
import { StatusTag } from './StatusTag'
import { getInstructionsSummary, getProposalStatus } from './utils'
import { useWallet } from '@solana/wallet-adapter-react'
import { AccountMeta } from '@solana/web3.js'
import {
  MultisigParser,
  getManyProposalsInstructions,
} from '@pythnetwork/xc-admin-common'

export const ProposalRow = ({
  proposal,
  multisig,
}: {
  proposal: TransactionAccount
  multisig: MultisigAccount | undefined
}) => {
  const [time, setTime] = useState<Date>()
  const [instructions, setInstructions] =
    useState<(readonly [string, number])[]>()
  const status = getProposalStatus(proposal, multisig)
  const { cluster } = useContext(ClusterContext)
  const {
    isLoading: isMultisigLoading,
    connection,
    readOnlySquads,
  } = useMultisigContext()
  const router = useRouter()
  const elementRef = useRef(null)
  const { publicKey: walletPublicKey } = useWallet()
  const formattedTime = time?.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })

  /**
   * Fetch the block time of the first transaction of the proposal
   * and calculates the instructions summary of the proposal
   * when the proposal is in view
   */
  useEffect(() => {
    let isCancelled = false
    const element = elementRef.current
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        if (isMultisigLoading) {
          return
        }

        // set proposal time
        if (!time) {
          connection
            .getSignaturesForAddress(proposal.publicKey)
            .then((txs) => {
              if (isCancelled) return
              const firstBlockTime = txs?.[txs.length - 1]?.blockTime
              if (firstBlockTime) {
                setTime(new Date(firstBlockTime * 1000))
              }
            })
            .catch((err) => {
              console.error(
                `Error fetching proposal time for ${proposal.publicKey.toBase58()}: ${err}`
              )
            })
        }

        // calculate instructions summary
        if (!instructions) {
          const proposalInstructions = (
            await getManyProposalsInstructions(readOnlySquads, [proposal])
          )[0]
          const multisigParser = MultisigParser.fromCluster(
            getMultisigCluster(cluster)
          )
          const parsedInstructions = proposalInstructions.map((ix) =>
            multisigParser.parseInstruction({
              programId: ix.programId,
              data: ix.data as Buffer,
              keys: ix.keys as AccountMeta[],
            })
          )

          const summary = getInstructionsSummary({
            instructions: parsedInstructions,
            cluster,
          })

          // show only the first two instructions
          // and group the rest under 'other'
          const shortSummary = summary.slice(0, 2)
          const otherValue = summary
            .slice(2)
            .map(({ count }) => count)
            .reduce((total, item) => total + item, 0)
          const updatedSummary = [
            ...shortSummary.map(({ name, count }) => [name, count] as const),
            ...(otherValue > 0
              ? ([['other', otherValue]] as [string, number][])
              : []),
          ]

          if (!isCancelled) {
            setInstructions(updatedSummary)
          }
        }
      }
    })

    if (element) {
      observer.observe(element)
    }

    // Clean up function
    return () => {
      isCancelled = true
      if (element) {
        observer.unobserve(element)
      }
    }
  }, [
    time,
    cluster,
    proposal,
    connection,
    readOnlySquads,
    isMultisigLoading,
    instructions,
  ])

  const handleClickIndividualProposal = useCallback(
    (proposalPubkey: string) => {
      router.query.proposal = proposalPubkey
      router.push(
        {
          pathname: router.pathname,
          query: router.query,
        },
        undefined,
        { scroll: true }
      )
    },
    [router]
  )

  return (
    <div
      ref={elementRef}
      className="my-2 cursor-pointer bg-[#1E1B2F] hover:bg-darkGray2"
      onClick={() =>
        handleClickIndividualProposal(proposal.publicKey.toBase58())
      }
    >
      <div className="flex flex-wrap gap-4 p-4">
        <div className="font-bold">{proposal.transactionIndex}</div>
        <div className="flex items-center">
          {formattedTime ?? (
            <div className="h-5 w-48 animate-pulse rounded bg-beige-300" />
          )}
        </div>
        <div className="flex">
          <span className="mr-2">
            {proposal.publicKey.toBase58().slice(0, 6) +
              '...' +
              proposal.publicKey.toBase58().slice(-6)}
          </span>{' '}
        </div>
        <div className="flex flex-grow gap-4">
          {instructions?.map(([name, count]) => (
            <div key={name}>
              {name}: {count}
            </div>
          ))}
        </div>
        <div className="flex space-x-2">
          {proposal.approved.length > 0 && status === 'active' && (
            <div>
              <StatusTag
                proposalStatus="executed"
                text={`Approved: ${proposal.approved.length}`}
              />
            </div>
          )}
          {proposal.rejected.length > 0 && status === 'active' && (
            <div>
              <StatusTag
                proposalStatus="rejected"
                text={`Rejected: ${proposal.rejected.length}`}
              />
            </div>
          )}
          {walletPublicKey &&
            proposal.approved.some((vote) => vote.equals(walletPublicKey)) && (
              <div>
                <StatusTag proposalStatus="executed" text="You approved" />
              </div>
            )}
          {walletPublicKey &&
            proposal.rejected.some((vote) => vote.equals(walletPublicKey)) && (
              <div>
                <StatusTag proposalStatus="rejected" text="You rejected" />
              </div>
            )}
          {walletPublicKey &&
            proposal.cancelled.some((vote) => vote.equals(walletPublicKey)) && (
              <div>
                <StatusTag proposalStatus="cancelled" text="You cancelled" />
              </div>
            )}
          <div>
            <StatusTag proposalStatus={status} />
          </div>
        </div>
      </div>
    </div>
  )
}
