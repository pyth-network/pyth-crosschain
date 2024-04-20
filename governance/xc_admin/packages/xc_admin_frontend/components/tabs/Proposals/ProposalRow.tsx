import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import { getProposalStatus } from './utils'
import { StatusTag } from './StatusTag'

export const ProposalRow = ({
  proposal,
  multisig,
}: {
  proposal: TransactionAccount
  multisig: MultisigAccount | undefined
}) => {
  const status = getProposalStatus(proposal, multisig)

  const router = useRouter()

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
      className="my-2 max-h-[58px] cursor-pointer bg-[#1E1B2F] hover:bg-darkGray2"
      onClick={() =>
        handleClickIndividualProposal(proposal.publicKey.toBase58())
      }
    >
      <div className="flex justify-between p-4">
        <div className="flex">
          <span className="mr-2 hidden sm:block">
            {proposal.publicKey.toBase58()}
          </span>
          <span className="mr-2 sm:hidden">
            {proposal.publicKey.toBase58().slice(0, 6) +
              '...' +
              proposal.publicKey.toBase58().slice(-6)}
          </span>{' '}
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
          <div>
            <StatusTag proposalStatus={status} />
          </div>
        </div>
      </div>
    </div>
  )
}
