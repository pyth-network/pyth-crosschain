use {
    super::ApiState,
    crate::state::aggregate::Aggregates,
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
        latest_publisher_stake_caps::*,
        price_feeds_metadata::*,
        sse::*,
        timestamp_price_updates::*,
    },
};

#[derive(Debug)]
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

/// Validate that the passed in price_ids exist in the aggregate state. Return a Vec of valid price ids.
/// # Returns  
/// If `remove_invalid` is true, invalid price ids are filtered out and only valid price ids are returned.
/// If `remove_invalid` is false and any passed in IDs are invalid, an error is returned.
pub async fn validate_price_ids<S>(
    state: &ApiState<S>,
    price_ids: &[PriceIdentifier],
    remove_invalid: bool,
) -> Result<Vec<PriceIdentifier>, RestError>
where
    S: Aggregates,
{
    let state = &*state.state;
    let available_ids = Aggregates::get_price_feed_ids(state).await;

    // Find any price IDs that don't exist in the valid set
    let not_found_ids: Vec<PriceIdentifier> = price_ids
        .iter()
        .filter(|id| !available_ids.contains(id))
        .copied()
        .collect();

    if !not_found_ids.is_empty() {
        // Some of the passed in IDs are invalid
        if remove_invalid {
            // Filter out invalid IDs and return only the valid ones
            Ok(price_ids
                .iter()
                .filter(|id| available_ids.contains(id))
                .copied()
                .collect())
        } else {
            // Return error with list of missing IDs
            Err(RestError::PriceIdsNotFound { missing_ids: not_found_ids })
        }
    } else {
        // All IDs are valid, return them unchanged
        Ok(price_ids.to_vec())
    }
}
