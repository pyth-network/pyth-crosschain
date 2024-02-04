use {
    crate::api::{
        rest::RestError,
        types::{
            AssetType,
            PriceFeedV2,
        },
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};


#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct PriceFeedsQueryParams {
    /// Optional query parameter to filter price feeds based on a query string. Case insensitive.
    #[serde(default)]
    #[param(example = "bitcoin")]
    query: Option<String>,

    /// Optional query parameter to filter price feeds based on asset type. Case insensitive.
    #[serde(default)]
    #[param(example = "crypto")]
    asset_type: Option<AssetType>,
}

/// Get the set of price feed IDs.
///
/// This endpoint fetches all of the price feed IDs for which price updates can be retrieved.
#[utoipa::path(
    get,
    path = "/v2/price_feeds",
    responses(
        (status = 200, description = "Price feeds metadata retrieved successfully", body = Vec<RpcPriceIdentifier>)
    ),
    params(
        PriceFeedsQueryParams
    )
)]
pub async fn price_feeds(
    State(state): State<crate::api::ApiState>,
    QsQuery(params): QsQuery<PriceFeedsQueryParams>,
) -> Result<Json<Vec<PriceFeedV2>>, RestError> {
    let price_feeds =
        crate::aggregate::get_price_feeds_v2(&*state.state, params.query, params.asset_type)
            .await
            .map_err(|e| {
                tracing::warn!("RPC connection error: {}", e);
                RestError::RpcConnectionError {
                    message: format!("RPC connection error: {}", e),
                }
            })?;

    Ok(Json(price_feeds))
}
