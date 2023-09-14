use {
    crate::api::{
        rest::RestError,
        types::RpcPriceIdentifier,
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
};

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
pub async fn price_feed_ids(
    State(state): State<crate::api::ApiState>,
) -> Result<Json<Vec<RpcPriceIdentifier>>, RestError> {
    let price_feed_ids = crate::aggregate::get_price_feed_ids(&*state.state)
        .await
        .iter()
        .map(RpcPriceIdentifier::from)
        .collect();

    Ok(Json(price_feed_ids))
}
