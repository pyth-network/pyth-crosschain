use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    /// Message sender not permitted to execute this operation
    #[error("PermissionDenied")]
    PermissionDenied,

    /// Wrapped asset not found in the registry
    #[error("PriceFeedNotFound")]
    PriceFeedNotFound,

    /// Message emitter is not an accepted data source.
    #[error("InvalidUpdateMessageEmitter")]
    InvalidUpdateMessageEmitter,

    /// Message payload cannot be deserialized to a batch attestation
    #[error("InvalidUpdateMessagePayload")]
    InvalidUpdateMessagePayload,
}

impl ContractError {
    pub fn std(&self) -> StdError {
        StdError::GenericErr {
            msg: format!("{}", self),
        }
    }

    pub fn std_err<T>(&self) -> Result<T, StdError> {
        Err(self.std())
    }
}
