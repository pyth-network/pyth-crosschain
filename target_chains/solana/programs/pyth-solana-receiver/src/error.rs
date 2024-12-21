use anchor_lang::prelude::*;

#[error_code]
pub enum ReceiverError {
    // Pyth payload errors
    #[msg("Received an invalid wormhole message")]
    InvalidWormholeMessage,
    #[msg("An error occurred when deserializing the message")]
    DeserializeMessageFailed,
    #[msg("Received an invalid price update")]
    InvalidPriceUpdate,
    #[msg("This type of message is not supported currently")]
    UnsupportedMessageType,
    #[msg("The tuple emitter chain, emitter doesn't match one of the valid data sources.")]
    InvalidDataSource,
    #[msg("Funds are insufficient to pay the receiving fee")]
    InsufficientFunds,
    #[msg("Cannot calculate TWAP, end slot must be greater than start slot")]
    FeedIdMismatch,
    #[msg("The start and end messages must have the same feed ID")]
    ExponentMismatch,
    #[msg("The start and end messages must have the same exponent")]
    InvalidTwapSlots,
    #[msg("Start message is not the first update for its timestamp")]
    InvalidTwapStartMessage,
    #[msg("End message is not the first update for its timestamp")]
    InvalidTwapEndMessage,
    #[msg("Overflow in TWAP calculation")]
    TwapCalculationOverflow,
    // Price account permissions
    #[msg("This signer can't write to price update account")]
    WrongWriteAuthority,
    // Wormhole contract encoded vaa error (from post_update)
    #[msg("The posted VAA account has the wrong owner.")]
    WrongVaaOwner,
    // Wormhole signatures verification errors (from post_update_atomic)
    #[msg("An error occurred when deserializing the VAA.")]
    DeserializeVaaFailed,
    #[msg("The number of guardian signatures is below the minimum")]
    InsufficientGuardianSignatures,
    #[msg("Invalid VAA version")]
    InvalidVaaVersion,
    #[msg("Guardian set version in the VAA doesn't match the guardian set passed")]
    GuardianSetMismatch,
    #[msg("Guardian signature indices must be increasing")]
    InvalidGuardianOrder,
    #[msg("Guardian index exceeds the number of guardians in the set")]
    InvalidGuardianIndex,
    #[msg("A VAA signature is invalid")]
    InvalidSignature,
    #[msg("The recovered guardian public key doesn't match the guardian set")]
    InvalidGuardianKeyRecovery,
    #[msg("The guardian set account is owned by the wrong program")]
    WrongGuardianSetOwner,
    #[msg("The Guardian Set account doesn't match the PDA derivation")]
    InvalidGuardianSetPda,
    #[msg("The Guardian Set is expired")]
    GuardianSetExpired,
    // Governance errors
    #[msg("The signer is not authorized to perform this governance action")]
    GovernanceAuthorityMismatch,
    #[msg("The signer is not authorized to accept the governance authority")]
    TargetGovernanceAuthorityMismatch,
    #[msg("The governance authority needs to request a transfer first")]
    NonexistentGovernanceAuthorityTransferRequest,
    #[msg("The minimum number of signatures should be at least 1")]
    ZeroMinimumSignatures,
}
