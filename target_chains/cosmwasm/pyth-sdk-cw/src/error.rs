use {
    cosmwasm_std::StdError,
    thiserror::Error,
};

#[derive(Error, Debug)]
pub enum PythContractError {
    /// Message sender not permitted to execute this operation
    #[error("PermissionDenied")]
    PermissionDenied,

    /// Wrapped asset not found in the registry
    #[error("PriceFeedNotFound")]
    PriceFeedNotFound,

    /// Message emitter is not an accepted data source.
    #[error("InvalidUpdateMessageEmitter")]
    InvalidUpdateEmitter,

    /// Message payload cannot be deserialized to a batch attestation
    #[error("InvalidUpdatePayload")]
    InvalidUpdatePayload,

    /// Data source does not exists error (on removing data source)
    #[error("DataSourceDoesNotExists")]
    DataSourceDoesNotExists,

    /// Data source already exists error (on adding data source)
    #[error("DataSourceAlreadyExists")]
    DataSourceAlreadyExists,

    /// Message emitter is not an accepted source of governance instructions.
    #[error("InvalidGovernanceEmitter")]
    InvalidGovernanceEmitter,

    /// Message payload cannot be deserialized as a valid governance instruction.
    #[error("InvalidGovernancePayload")]
    InvalidGovernancePayload,

    /// The sequence number of the governance message is too old.
    #[error("OldGovernanceMessage")]
    OldGovernanceMessage,

    /// The governance source index it not valid.
    #[error("OldGovernanceMessage")]
    InvalidGovernanceSourceIndex,

    /// The message did not include a sufficient fee.
    #[error("InsufficientFee")]
    InsufficientFee,
}

impl From<PythContractError> for StdError {
    fn from(other: PythContractError) -> StdError {
        StdError::GenericErr {
            msg: format!("{other}"),
        }
    }
}
