use {
    crate::{
        api::{rest::RestError, ApiState},
        state::aggregate::Aggregates,
    },
    axum::extract::State,
};

/// Get the latest TWAP by price feed id with a custom time window.
///
/// This endpoint has been deprecated.
pub async fn latest_twaps<S>(State(_state): State<ApiState<S>>) -> Result<(), RestError>
where
    S: Aggregates,
{
    Err(RestError::EndpointDeprecated {
        message: "The TWAP endpoint has been deprecated and is no longer available.".to_string(),
    })
}
