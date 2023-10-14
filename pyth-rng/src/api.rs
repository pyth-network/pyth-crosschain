use std::sync::Arc;

use axum::{
    http::StatusCode,
    response::{
        IntoResponse,
        Response,
    },
};

pub use {
    get_randomness_proof::*,
};

use crate::PebbleHashChain;

mod get_randomness_proof;

#[derive(Clone)]
pub struct ApiState {
    pub state: Arc<PebbleHashChain>,
    pub provider: Arc<PythProvider>,
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

