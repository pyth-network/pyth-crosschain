import type { ProposalStatus } from './utils'

const getProposalBackgroundColorClassName = (
  proposalStatus: ProposalStatus
) => {
  switch (proposalStatus) {
    case 'active': {
      return 'bg-[#3C3299]'
    }
    case 'executed': {
      return 'bg-[#1B730E]'
    }
    case 'cancelled': {
      return 'bg-[#C4428F]'
    }
    case 'rejected': {
      return 'bg-[#CF6E42]'
    }
    case 'expired': {
      return 'bg-[#A52A2A]'
    }
    default: {
      return 'bg-pythPurple'
    }
  }
}

export const StatusTag = ({
  proposalStatus,
  text,
}: {
  proposalStatus: ProposalStatus
  text?: string
}) => {
  return (
    <div
      className={`flex items-center justify-center rounded-full ${getProposalBackgroundColorClassName(
        proposalStatus
      )} py-1 px-2 text-xs`}
    >
      {text || proposalStatus}
    </div>
  )
}
