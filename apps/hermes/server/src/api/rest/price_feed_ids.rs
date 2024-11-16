use {
    crate::{
        api::{rest::RestError, types::RpcPriceIdentifier, ApiState},
        state::aggregate::Aggregates,
    },
    anyhow::Result,
    axum::{extract::State, Json},
};

/// **Deprecated: use /v2/price_feeds instead**
///
/// Get the set of price feed IDs.
///
/// This endpoint fetches all of the price feed IDs for which price updates can be retrieved.
#[utoipa::path(
    get,
    path = "/api/price_feed_ids",
    params(),
    responses(
        (status = 200, description = "Price feed ids retrieved successfully", body = Vec<RpcPriceIdentifier>)
    ),
)]
#[deprecated]
pub async fn price_feed_ids<S>(
    State(state): State<ApiState<S>>,
) -> Result<Json<Vec<RpcPriceIdentifier>>, RestError>
where
    S: Aggregates,
{
    let state = &*state.state;
    let price_feed_ids = Aggregates::get_price_feed_ids(state)
        .await
        .into_iter()
        .map(RpcPriceIdentifier::from)
        .collect();

    Ok(Json(price_feed_ids))
}
