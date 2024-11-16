use {
    near_sdk::{serde::Serialize, FunctionError},
    thiserror::Error,
};

/// Small macro for throwing errors in the contract when a boolean condition is not met.
///
/// It would be nice to have anyhow::ensure!() here, but the contract acts as a library and a
/// concrete error type is a better API for this case.
#[macro_export]
macro_rules! ensure {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}

#[derive(Error, Debug, Serialize, FunctionError)]
#[serde(crate = "near_sdk::serde")]
pub enum Error {
    #[error("A hex argument could not be decoded.")]
    InvalidHex,

    #[error("A VAA could not be deserialized.")]
    InvalidVaa,

    #[error("A VAA payload could not be deserialized.")]
    InvalidPayload,

    #[error("Governance Module ID not valid.")]
    InvalidGovernanceModule,

    #[error("Governance Module Action not valid.")]
    InvalidGovernanceAction,

    #[error("Source for attestation is not allowed. {0:?}")]
    UnknownSource([u8; 32]),

    #[error("Unauthorized Upgrade.")]
    UnauthorizedUpgrade,

    #[error("Insufficient tokens deposited to cover storage.")]
    InsufficientDeposit,

    #[error("VAA verification failed.")]
    VaaVerificationFailed,

    #[error("Fee is too large.")]
    FeeTooLarge,

    #[error("Arithmetic overflow.")]
    ArithmeticOverflow,

    #[error("Unknown error.")]
    Unknown,

    #[error("Invalid merkle proof.")]
    InvalidMerkleProof,

    #[error("Invalid accumulator message.")]
    InvalidAccumulatorMessage,

    #[error("Invalid accumulator message type.")]
    InvalidAccumulatorMessageType,

    #[error("Invalid wormhole message.")]
    InvalidWormholeMessage,
}

/// Convert IO errors into Payload errors, the only I/O we do is parsing with `Cursor` so this is a
/// reasonable conversion.
impl From<std::io::Error> for Error {
    fn from(_: std::io::Error) -> Self {
        Error::InvalidPayload
    }
}

/// Convert `nom` errors into local crate `InvalidPayload` errors.
impl From<nom::Err<nom::error::Error<&[u8]>>> for Error {
    fn from(_: nom::Err<nom::error::Error<&[u8]>>) -> Self {
        Error::InvalidPayload
    }
}
