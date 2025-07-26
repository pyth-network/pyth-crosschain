use anchor_lang::prelude::*;

#[error_code]
pub enum EntropyError {
    #[msg("Provider not found")]
    NoSuchProvider,

    #[msg("Request not found")]
    NoSuchRequest,

    #[msg("Insufficient fee provided")]
    InsufficientFee,

    #[msg("Provider is out of randomness")]
    OutOfRandomness,

    #[msg("Incorrect revelation provided")]
    IncorrectRevelation,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Invalid reveal call")]
    InvalidRevealCall,

    #[msg("Assertion failure")]
    AssertionFailure,

    #[msg("Update too old")]
    UpdateTooOld,

    #[msg("Last revealed too old")]
    LastRevealedTooOld,

    #[msg("Insufficient gas")]
    InsufficientGas,

    #[msg("Max gas limit exceeded")]
    MaxGasLimitExceeded,

    #[msg("Blockhash unavailable")]
    BlockhashUnavailable,

    #[msg("Zero minimum signatures")]
    ZeroMinimumSignatures,

    #[msg("Invalid guardian order")]
    InvalidGuardianOrder,

    #[msg("Invalid guardian index")]
    InvalidGuardianIndex,
}
