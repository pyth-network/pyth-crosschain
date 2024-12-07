import { TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useState, useMemo } from 'react'
import { ClusterContext } from '../../../contexts/ClusterContext'
import { useMultisigContext } from '../../../contexts/MultisigContext'
import { PROPOSAL_STATUSES } from './utils'
import ClusterSwitch from '../../ClusterSwitch'
import Loadbar from '../../loaders/Loadbar'
import { Select } from '../../Select'
import { useQueryState, parseAsStringLiteral } from 'nuqs'

import { ProposalRow } from './ProposalRow'
import { getProposalStatus } from './utils'
import { Proposal } from './Proposal'
import { useWallet } from '@solana/wallet-adapter-react'

type ProposalType = 'priceFeed' | 'governance'

const VOTE_STATUSES = [
  'any',
  'voted',
  'approved',
  'rejected',
  'cancelled',
  'notVoted',
] as const
const DEFAULT_VOTE_STATUS = 'any'

const PROPOSAL_STATUS_FILTERS = ['all', ...PROPOSAL_STATUSES] as const
const DEFAULT_PROPOSAL_STATUS_FILTER = 'all'

const Proposals = () => {
  const router = useRouter()
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [currentProposalPubkey, setCurrentProposalPubkey] = useState<string>()
  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsStringLiteral(PROPOSAL_STATUS_FILTERS).withDefault(
      DEFAULT_PROPOSAL_STATUS_FILTER
    )
  )
  const [voteStatus, setVoteStatus] = useQueryState(
    'voteStatus',
    parseAsStringLiteral(VOTE_STATUSES).withDefault(DEFAULT_VOTE_STATUS)
  )
  const { cluster } = useContext(ClusterContext)
  const { publicKey: walletPublicKey } = useWallet()

  const {
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    priceFeedMultisigProposals,
    upgradeMultisigProposals,
    isLoading: isMultisigLoading,
    refreshData,
  } = useMultisigContext()

  const [proposalType, setProposalType] = useState<ProposalType>('priceFeed')

  const multisigAccount =
    proposalType === 'priceFeed'
      ? priceFeedMultisigAccount
      : upgradeMultisigAccount
  const multisigProposals =
    proposalType === 'priceFeed'
      ? priceFeedMultisigProposals
      : upgradeMultisigProposals

  const handleClickBackToProposals = () => {
    delete router.query.proposal
    router.push(
      {
        pathname: router.pathname,
        query: router.query,
      },
      undefined,
      { scroll: false }
    )
  }

  useEffect(() => {
    if (router.query.proposal) {
      setCurrentProposalPubkey(router.query.proposal as string)
    } else {
      setCurrentProposalPubkey(undefined)
    }
  }, [router.query.proposal])

  const switchProposalType = useCallback(() => {
    if (proposalType === 'priceFeed') {
      setProposalType('governance')
    } else {
      setProposalType('priceFeed')
    }
  }, [proposalType])

  useEffect(() => {
    if (currentProposalPubkey) {
      const currProposal = multisigProposals.find(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      setCurrentProposal(currProposal)
      if (currProposal === undefined) {
        const otherProposals =
          proposalType !== 'priceFeed'
            ? priceFeedMultisigProposals
            : upgradeMultisigProposals
        if (
          otherProposals.findIndex(
            (proposal) =>
              proposal.publicKey.toBase58() === currentProposalPubkey
          ) !== -1
        ) {
          switchProposalType()
        }
      }
    }
  }, [
    switchProposalType,
    priceFeedMultisigProposals,
    proposalType,
    upgradeMultisigProposals,
    currentProposalPubkey,
    multisigProposals,
    cluster,
  ])

  const proposalsFilteredByStatus = useMemo(
    () =>
      statusFilter === 'all'
        ? multisigProposals
        : multisigProposals.filter(
            (proposal) =>
              getProposalStatus(proposal, multisigAccount) === statusFilter
          ),
    [statusFilter, multisigAccount, multisigProposals]
  )

  const filteredProposals = useMemo(() => {
    if (walletPublicKey) {
      switch (voteStatus) {
        case 'any':
          return proposalsFilteredByStatus
        case 'voted': {
          return proposalsFilteredByStatus.filter((proposal) =>
            [
              ...proposal.approved,
              ...proposal.rejected,
              ...proposal.cancelled,
            ].some((vote) => vote.equals(walletPublicKey))
          )
        }
        case 'approved': {
          return proposalsFilteredByStatus.filter((proposal) =>
            proposal.approved.some((vote) => vote.equals(walletPublicKey))
          )
        }
        case 'rejected': {
          return proposalsFilteredByStatus.filter((proposal) =>
            proposal.rejected.some((vote) => vote.equals(walletPublicKey))
          )
        }
        case 'cancelled': {
          return proposalsFilteredByStatus.filter((proposal) =>
            proposal.cancelled.some((vote) => vote.equals(walletPublicKey))
          )
        }
        case 'notVoted': {
          return proposalsFilteredByStatus.filter((proposal) =>
            [
              ...proposal.approved,
              ...proposal.rejected,
              ...proposal.cancelled,
            ].every((vote) => !vote.equals(walletPublicKey))
          )
        }
      }
    } else {
      return proposalsFilteredByStatus
    }
  }, [proposalsFilteredByStatus, walletPublicKey, voteStatus])

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">
            {proposalType === 'priceFeed' ? 'Price Feed ' : 'Governance '}{' '}
            {router.query.proposal === undefined ? 'Proposals' : 'Proposal'}
          </h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        {router.query.proposal === undefined ? (
          <>
            <div className="flex flex-col justify-between md:flex-row">
              <div className="mb-4 flex items-center md:mb-0">
                <ClusterSwitch />
              </div>
              <div className="flex space-x-2">
                {refreshData && (
                  <button
                    disabled={isMultisigLoading}
                    className="sub-action-btn text-base"
                    onClick={() => {
                      const { fetchData } = refreshData()
                      fetchData()
                    }}
                  >
                    Refresh
                  </button>
                )}
                <button
                  disabled={isMultisigLoading}
                  className="action-btn text-base"
                  onClick={switchProposalType}
                >
                  Show
                  {proposalType !== 'priceFeed'
                    ? ' Price Feed '
                    : ' Governance '}
                  Proposals
                </button>
              </div>
            </div>
            <div className="relative mt-6">
              {isMultisigLoading ? (
                <div className="mt-3">
                  <Loadbar theme="light" />
                </div>
              ) : (
                <>
                  <div className="flex items-end md:flex-row-reverse justify-between pb-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
                      {walletPublicKey && (
                        <Select
                          label="Your Vote"
                          value={voteStatus}
                          options={VOTE_STATUSES}
                          onChange={setVoteStatus}
                        />
                      )}
                      <Select
                        label="Proposal Status"
                        value={statusFilter}
                        options={PROPOSAL_STATUS_FILTERS}
                        onChange={setStatusFilter}
                      />
                    </div>
                    <h4 className="h4">
                      Total Proposals: {filteredProposals.length}
                    </h4>
                  </div>
                  {filteredProposals.length > 0 ? (
                    <div className="flex flex-col">
                      {filteredProposals.map((proposal, _idx) => (
                        <ProposalRow
                          key={proposal.publicKey.toBase58()}
                          proposal={proposal}
                          multisig={multisigAccount}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      No proposals found. If you&apos;re a member of the
                      multisig, you can create a proposal.
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : !isMultisigLoading && currentProposal !== undefined ? (
          <>
            <div
              className="max-w-fit cursor-pointer bg-darkGray2 p-3 text-xs font-semibold outline-none transition-colors hover:bg-darkGray3 md:text-base"
              onClick={handleClickBackToProposals}
            >
              &#8592; back to proposals
            </div>
            <div className="relative mt-6">
              <Proposal proposal={currentProposal} multisig={multisigAccount} />
            </div>
          </>
        ) : (
          <div className="mt-3">
            <Loadbar theme="light" />
          </div>
        )}
      </div>
    </div>
  )
}

export default Proposals
