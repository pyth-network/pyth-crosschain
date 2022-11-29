use {
    near_sdk::serde::Serialize,
    thiserror::Error,
};

#[derive(Error, Debug, Serialize)]
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
}

impl near_sdk::FunctionError for Error {
    fn panic(&self) -> ! {
        near_sdk::env::panic_str(&self.to_string())
    }
}
