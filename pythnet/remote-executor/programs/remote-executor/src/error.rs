use anchor_lang::prelude::*;

#[error_code]
pub enum ExecutorError {
    EmitterChainNotSolana,
    NonIncreasingSequence,
    GovernanceHeaderInvalidMagicNumber,
    GovernanceHeaderInvalidModule,
    GovernanceHeaderInvalidAction,
    GovernanceHeaderInvalidReceiverChain,
    PostedVaaHeaderWrongMagicNumber,
}
