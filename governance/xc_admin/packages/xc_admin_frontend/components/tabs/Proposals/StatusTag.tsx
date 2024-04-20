import { ProposalStatus } from './utils'

const getProposalBackgroundColorClassName = (
  proposalStatus: ProposalStatus
) => {
  if (proposalStatus === 'active') {
    return 'bg-[#3C3299]'
  } else if (proposalStatus === 'executed') {
    return 'bg-[#1B730E]'
  } else if (proposalStatus === 'cancelled') {
    return 'bg-[#C4428F]'
  } else if (proposalStatus === 'rejected') {
    return 'bg-[#CF6E42]'
  } else if (proposalStatus === 'expired') {
    return 'bg-[#A52A2A]'
  } else {
    return 'bg-pythPurple'
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
