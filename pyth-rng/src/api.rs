use std::sync::Arc;

use axum::{
    http::StatusCode,
    response::{
        IntoResponse,
        Response,
    },
};
use ethers::core::types::Address;

pub use {
    index::*,
    revelation::*,
};

use crate::ethereum::PythContract;
use crate::state::HashChainState;

mod revelation;
mod index;

/// The state of the randomness service for a single blockchain.
#[derive(Clone)]
pub struct ApiState {
    /// The hash chain(s) required to serve random numbers for this blockchain
    pub state: Arc<HashChainState>,
    /// The EVM contract where the protocol is running.
    pub contract: Arc<PythContract>,
    /// The EVM address of the provider that this server is operating for.
    pub provider_address: Address,
}


pub enum RestError {
    /// The caller passed a sequence number that isn't within the supported range
    InvalidSequenceNumber,
    /// The caller requested a random value that can't currently be revealed (because it
    /// hasn't been committed to on-chain)
    NoPendingRequest,
    /// The server cannot currently communicate with the blockchain, so is not able to verify
    /// which random values have been requested.
    TemporarilyUnavailable,
    /// A catch-all error for all other types of errors that could occur during processing.
    Unknown,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::InvalidSequenceNumber => {
                (StatusCode::BAD_REQUEST, "The sequence number is out of the permitted range").into_response()
            }
            RestError::NoPendingRequest => {
                (StatusCode::FORBIDDEN, "The random value cannot currently be retrieved").into_response()
            }
            RestError::TemporarilyUnavailable => {
                (StatusCode::SERVICE_UNAVAILABLE, "This service is temporarily unavailable").into_response()
            }
            RestError::Unknown => {
                (StatusCode::INTERNAL_SERVER_ERROR, "An unknown error occurred processing the request").into_response()
            },
        }
    }
}

