export const StatusTag = ({
    proposalStatus,
    text,
}: {
    proposalStatus: string
    text?: string
}) => {
    return (
        <div
            className={`flex items-center justify-center rounded-full ${proposalStatus === 'active'
                    ? 'bg-[#3C3299]'
                    : proposalStatus === 'executed'
                        ? 'bg-[#1B730E]'
                        : proposalStatus === 'cancelled'
                            ? 'bg-[#C4428F]'
                            : proposalStatus === 'rejected'
                                ? 'bg-[#CF6E42]'
                                : proposalStatus === 'expired'
                                    ? 'bg-[#A52A2A]'
                                    : 'bg-pythPurple'
                } py-1 px-2 text-xs`}
        >
            {text || proposalStatus}
        </div>
    )
}