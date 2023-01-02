use {
    near_sdk::{
        serde::Serialize,
        FunctionError,
    },
    thiserror::Error,
};

#[derive(Error, Debug, Serialize, FunctionError)]
#[serde(crate = "near_sdk::serde")]
pub enum Error {
    #[error("A hex argument could not be decoded.")]
    InvalidHex,

    #[error("A VAA could not be deserialized.")]
    InvalidVaa,

    #[error("A VAA payload could not be deserialized.")]
    InvalidPayload,

    #[error("Source for attestation is not allowed.")]
    UnknownSource,

    #[error("Unauthorized Upgrade")]
    UnauthorizedUpgrade,

    #[error("Insufficient tokens deposited to cover storage.")]
    InsufficientDeposit,

    #[error("VAA verification failed.")]
    VaaVerificationFailed,

    #[error("Fee is too large.")]
    FeeTooLarge,
}

/// Convert IO errors into Payload errors, the only I/O we do is parsing with `Cursor` so this is a
/// reasonable conversion.
impl From<std::io::Error> for Error {
    fn from(_: std::io::Error) -> Self {
        Error::InvalidPayload
    }
}
