use {
    super::ApiState,
    axum::{
        http::StatusCode,
        response::{
            IntoResponse,
            Response,
        },
    },
    pyth_sdk::PriceIdentifier,
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
mod v2;

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
    v2::{
        latest_price_updates::*,
        price_feeds_metadata::*,
        timestamp_price_updates::*,
    },
};

pub enum RestError {
    BenchmarkPriceNotUnique,
    UpdateDataNotFound,
    CcipUpdateDataNotFound,
    InvalidCCIPInput,
    PriceIdsNotFound { missing_ids: Vec<PriceIdentifier> },
    RpcConnectionError { message: String },
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::BenchmarkPriceNotUnique => {
                (StatusCode::NOT_FOUND, "Benchmark price is not unique").into_response()
            }
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
            RestError::PriceIdsNotFound { missing_ids } => {
                let missing_ids = missing_ids
                    .into_iter()
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(", ");

                (
                    StatusCode::NOT_FOUND,
                    format!("Price ids not found: {}", missing_ids),
                )
                    .into_response()
            }
            RestError::RpcConnectionError { message } => {
                (StatusCode::INTERNAL_SERVER_ERROR, message).into_response()
            }
        }
    }
}

/// Verify that the price ids exist in the aggregate state.
pub async fn verify_price_ids_exist(
    state: &ApiState,
    price_ids: &[PriceIdentifier],
) -> Result<(), RestError> {
    let all_ids = crate::aggregate::get_price_feed_ids(&*state.state).await;
    let missing_ids = price_ids
        .iter()
        .filter(|id| !all_ids.contains(id))
        .cloned()
        .collect::<Vec<_>>();

    if !missing_ids.is_empty() {
        return Err(RestError::PriceIdsNotFound { missing_ids });
    }

    Ok(())
}
