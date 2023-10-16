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
    get_randomness_proof::*,
};

use crate::ethereum::PythProvider;
use crate::PebbleHashChain;

mod get_randomness_proof;

// TODO: need to consider what happens if we've committed to multiple chains
// due to rotations. The older chains need to stick around too.
#[derive(Clone)]
pub struct ApiState {
    pub state: Arc<PebbleHashChain>,
    pub contract: Arc<PythProvider>,
    pub provider: Address,
}

// FIXME: real errors
pub enum RestError {
    TestError,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::TestError => {
                (StatusCode::NOT_FOUND, "Update data not found").into_response()
            }
        }
    }
}

