import { TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useState } from 'react'
import { ClusterContext } from '../../../contexts/ClusterContext'
import { useMultisigContext } from '../../../contexts/MultisigContext'
import { StatusFilterContext } from '../../../contexts/StatusFilterContext'
import ClusterSwitch from '../../ClusterSwitch'
import ProposalStatusFilter from '../../ProposalStatusFilter'
import Loadbar from '../../loaders/Loadbar'

import { ProposalRow } from './ProposalRow'
import { getProposalStatus } from './utils'
import { Proposal } from './Proposal'

type ProposalType = 'priceFeed' | 'governance'

const Proposals = () => {
  const router = useRouter()
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [currentProposalPubkey, setCurrentProposalPubkey] = useState<string>()
  const { cluster } = useContext(ClusterContext)
  const { statusFilter } = useContext(StatusFilterContext)

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
  const [filteredProposals, setFilteredProposals] = useState<
    TransactionAccount[]
  >([])

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

  useEffect(() => {
    // filter price feed multisig proposals by status
    if (statusFilter === 'all') {
      setFilteredProposals(multisigProposals)
    } else {
      setFilteredProposals(
        multisigProposals.filter(
          (proposal) =>
            getProposalStatus(proposal, multisigAccount) === statusFilter
        )
      )
    }
  }, [statusFilter, multisigAccount, multisigProposals])

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
                  <div className="flex items-center justify-between pb-4">
                    <h4 className="h4">
                      Total Proposals: {filteredProposals.length}
                    </h4>
                    <ProposalStatusFilter />
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
