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

    #[error("Source for attestation is not allowed.")]
    UnknownSource,

    #[error("Unauthorized Upgrade")]
    UnauthorizedUpgrade,

    #[error("Insufficient tokens deposited to cover storage.")]
    InsufficientDeposit,

    #[error("VAA verification failed.")]
    VaaVerificationFailed,
}
