import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'


export const getProposalStatus = (
    proposal: TransactionAccount | undefined,
    multisig: MultisigAccount | undefined
): string => {
    if (multisig && proposal) {
        const onChainStatus = Object.keys(proposal.status)[0]
        return proposal.transactionIndex <= multisig.msChangeIndex &&
            (onChainStatus == 'active' || onChainStatus == 'draft')
            ? 'expired'
            : onChainStatus
    } else {
        return 'unkwown'
    }
}