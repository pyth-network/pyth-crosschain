import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'

export type ProposalStatus = 'active' | 'executed' | 'cancelled' | 'rejected' | 'expired' | 'executeReady' | 'draft' | 'unkwown'

export const getProposalStatus = (
    proposal: TransactionAccount | undefined,
    multisig: MultisigAccount | undefined
): ProposalStatus => {
    if (multisig && proposal) {
        const onChainStatus = Object.keys(proposal.status)[0]
        return proposal.transactionIndex <= multisig.msChangeIndex &&
            (onChainStatus == 'active' || onChainStatus == 'draft')
            ? 'expired'
            : onChainStatus as ProposalStatus
    } else {
        return 'unkwown'
    }
}