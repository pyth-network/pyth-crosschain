use {
    super::validate_price_ids,
    crate::{
        api::{
            rest::RestError,
            types::{PriceIdInput, RpcPriceFeed},
            ApiState,
        },
        state::aggregate::{Aggregates, RequestTime},
    },
    anyhow::Result,
    axum::{extract::State, Json},
    pyth_sdk::PriceIdentifier,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestPriceFeedsQueryParams {
    /// Get the most recent price update for this set of price feed ids.
    ///
    /// This parameter can be provided multiple times to retrieve multiple price updates,
    /// for example see the following query string:
    ///
    /// ```
    /// ?ids[]=a12...&ids[]=b4c...
    /// ```
    #[param(rename = "ids[]")]
    #[param(example = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43")]
    ids: Vec<PriceIdInput>,

    /// If true, include the `metadata` field in the response with additional metadata about
    /// the price update.
    #[serde(default)]
    verbose: bool,

    /// If true, include the binary price update in the `vaa` field of each returned feed.
    /// This binary data can be submitted to Pyth contracts to update the on-chain price.
    #[serde(default)]
    binary: bool,
}

/// **Deprecated: use /v2/updates/price/latest instead**
///
/// Get the latest price updates by price feed id.
///
/// Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.
#[utoipa::path(
    get,
    path = "/api/latest_price_feeds",
    responses(
        (status = 200, description = "Price updates retrieved successfully", body = Vec<RpcPriceFeed>)
    ),
    params(
        LatestPriceFeedsQueryParams
    )
)]
#[deprecated]
pub async fn latest_price_feeds<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<LatestPriceFeedsQueryParams>,
) -> Result<Json<Vec<RpcPriceFeed>>, RestError>
where
    S: Aggregates,
{
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();
    validate_price_ids(&state, &price_ids, false).await?;

    let state = &*state.state;
    let price_feeds_with_update_data =
        Aggregates::get_price_feeds_with_update_data(state, &price_ids, RequestTime::Latest)
            .await
            .map_err(|e| {
                tracing::warn!(
                    "Error getting price feeds {:?} with update data: {:?}",
                    price_ids,
                    e
                );
                RestError::UpdateDataNotFound
            })?;

    Ok(Json(
        price_feeds_with_update_data
            .price_feeds
            .into_iter()
            .map(|price_feed| {
                RpcPriceFeed::from_price_feed_update(price_feed, params.verbose, params.binary)
            })
            .collect(),
    ))
}
