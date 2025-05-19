import { TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState, useMemo, Fragment } from 'react'
import { ClusterContext } from '../../../contexts/ClusterContext'
import { useMultisigContext } from '../../../contexts/MultisigContext'
import { PROPOSAL_STATUSES } from './utils'
import ClusterSwitch from '../../ClusterSwitch'
import Loadbar from '../../loaders/Loadbar'
import { Select } from '../../Select'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { Menu, Transition } from '@headlessui/react'

import { ProposalRow } from './ProposalRow'
import { getProposalStatus } from './utils'
import { Proposal } from './Proposal'
import { useWallet } from '@solana/wallet-adapter-react'

type ProposalType = 'priceFeed' | 'governance' | 'lazer'

const PROPOSAL_TYPE_NAMES: Record<ProposalType, string> = {
  priceFeed: 'Price Feed',
  governance: 'Governance',
  lazer: 'Lazer',
}

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

const Arrow = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="10"
    height="6"
    viewBox="0 0 10 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 1L5 5L9 1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

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

  const multisigAccount = useMemo(() => {
    switch (proposalType) {
      case 'priceFeed':
        return priceFeedMultisigAccount
      case 'governance':
        return upgradeMultisigAccount
      default:
        return priceFeedMultisigAccount
    }
  }, [proposalType, priceFeedMultisigAccount, upgradeMultisigAccount])

  const multisigProposals = useMemo(() => {
    switch (proposalType) {
      case 'priceFeed':
        return priceFeedMultisigProposals
      case 'governance':
        return upgradeMultisigProposals
      case 'lazer':
        return []
      default:
        return priceFeedMultisigProposals
    }
  }, [proposalType, priceFeedMultisigProposals, upgradeMultisigProposals])

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

  useEffect(() => {
    if (currentProposalPubkey) {
      const currProposal = multisigProposals.find(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      setCurrentProposal(currProposal)
      if (currProposal === undefined) {
        // Check if the proposal exists in other proposal types
        const allProposalTypes: ProposalType[] = ['priceFeed', 'governance']
        for (const type of allProposalTypes) {
          if (type === proposalType) continue

          let otherProposals: TransactionAccount[] = []
          switch (type) {
            case 'priceFeed':
              otherProposals = priceFeedMultisigProposals
              break
            case 'governance':
              otherProposals = upgradeMultisigProposals
              break
          }

          if (
            otherProposals.findIndex(
              (proposal) =>
                proposal.publicKey.toBase58() === currentProposalPubkey
            ) !== -1
          ) {
            setProposalType(type)
            break
          }
        }
      }
    }
  }, [
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

  // Convert proposal types to array of options
  const proposalTypeOptions: ProposalType[] = [
    'priceFeed',
    'governance',
    'lazer',
  ]

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">
            {PROPOSAL_TYPE_NAMES[proposalType]}{' '}
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
                <Menu
                  as="div"
                  className="relative z-[5] block w-[180px] text-left"
                >
                  {({ open }) => (
                    <>
                      <Menu.Button
                        className="inline-flex w-full items-center justify-between py-3 px-6 text-sm outline-0 bg-darkGray2 action-btn"
                        disabled={isMultisigLoading}
                      >
                        <span className="mr-3">
                          {PROPOSAL_TYPE_NAMES[proposalType]} Proposals
                        </span>
                        <Arrow className={`${open ? 'rotate-180' : ''}`} />
                      </Menu.Button>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 mt-2 w-full origin-top-right">
                          {proposalTypeOptions.map((type) => (
                            <Menu.Item key={type}>
                              {({ active }) => (
                                <button
                                  className={`block w-full py-3 px-6 text-left text-sm ${
                                    active ? 'bg-darkGray2' : 'bg-darkGray'
                                  }`}
                                  onClick={() => setProposalType(type)}
                                >
                                  {PROPOSAL_TYPE_NAMES[type]} Proposals
                                </button>
                              )}
                            </Menu.Item>
                          ))}
                        </Menu.Items>
                      </Transition>
                    </>
                  )}
                </Menu>
              </div>
            </div>
            <div className="relative mt-6">
              {isMultisigLoading ? (
                <div className="mt-3">
                  <Loadbar theme="light" />
                </div>
              ) : proposalType === 'lazer' ? (
                <div className="mt-4">
                  Lazer proposals are not supported yet.
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
