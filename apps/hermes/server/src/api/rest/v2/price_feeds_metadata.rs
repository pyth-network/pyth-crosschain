use {
    crate::{
        api::{
            rest::RestError,
            types::{AssetType, PriceFeedMetadata},
            ApiState,
        },
        state::price_feeds_metadata::PriceFeedMeta,
    },
    anyhow::Result,
    axum::{extract::State, Json},
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct PriceFeedsMetadataQueryParams {
    /// Optional query parameter. If provided, the results will be filtered to all price feeds whose symbol contains the query string. Query string is case insensitive.
    #[param(example = "bitcoin")]
    query: Option<String>,

    /// Optional query parameter. If provided, the results will be filtered by asset type. Possible values are crypto, equity, fx, metal, rates. Filter string is case insensitive.
    #[param(example = "crypto")]
    asset_type: Option<AssetType>,
}

/// Get the set of price feeds.
///
/// This endpoint fetches all price feeds from the Pyth network. It can be filtered by asset type
/// and query string.
#[utoipa::path(
    get,
    path = "/v2/price_feeds",
    responses(
        (status = 200, description = "Price feeds metadata retrieved successfully", body = Vec<PriceFeedMetadata>)
    ),
    params(
        PriceFeedsMetadataQueryParams
    )
)]
pub async fn price_feeds_metadata<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<PriceFeedsMetadataQueryParams>,
) -> Result<Json<Vec<PriceFeedMetadata>>, RestError>
where
    S: PriceFeedMeta,
{
    let state = &state.state;
    let price_feeds_metadata = state
        .get_price_feeds_metadata(params.query, params.asset_type)
        .await
        .map_err(|e| {
            tracing::warn!("RPC connection error: {}", e);
            RestError::RpcConnectionError {
                message: format!("RPC connection error: {}", e),
            }
        })?;

    Ok(Json(price_feeds_metadata))
}
