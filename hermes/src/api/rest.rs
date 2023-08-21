use axum::{
    http::StatusCode,
    response::{
        IntoResponse,
        Response,
    },
};

mod get_price_feed;
mod get_vaa;
mod get_vaa_ccip;
mod index;
mod latest_price_feeds;
mod latest_vaas;
mod live;
mod price_feed_ids;
mod ready;

pub use {
    get_price_feed::*,
    get_vaa::*,
    get_vaa_ccip::*,
    index::*,
    latest_price_feeds::*,
    latest_vaas::*,
    live::*,
    price_feed_ids::*,
    ready::*,
};

pub enum RestError {
    UpdateDataNotFound,
    CcipUpdateDataNotFound,
    InvalidCCIPInput,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::UpdateDataNotFound => {
                (StatusCode::NOT_FOUND, "Update data not found").into_response()
            }
            RestError::CcipUpdateDataNotFound => {
                // Return "Bad Gateway" error because CCIP expects a 5xx error if it needs to retry
                // or try other endpoints. "Bad Gateway" seems the best choice here as this is not
                // an internal error and could happen on two scenarios:
                //
                // 1. DB Api is not responding well (Bad Gateway is appropriate here)
                // 2. Publish time is a few seconds before current time and a VAA Will be available
                //    in a few seconds. So we want the client to retry.
                (StatusCode::BAD_GATEWAY, "CCIP update data not found").into_response()
            }
            RestError::InvalidCCIPInput => {
                (StatusCode::BAD_REQUEST, "Invalid CCIP input").into_response()
            }
        }
    }
}
