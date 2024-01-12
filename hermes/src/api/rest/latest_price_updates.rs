use {
    super::verify_price_ids_exist,
    crate::{
        aggregate::RequestTime,
        api::{
            rest::RestError,
            types::{
                EncodingType,
                PriceIdInput,
                PriceUpdate,
            },
        },
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    pyth_sdk::PriceIdentifier,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};


#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestPriceUpdatesQueryParams {
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

    /// If true, include the parsed price update in the `parsed` field of each returned feed.
    #[serde(default)]
    encoding: EncodingType,

    /// If true, include the parsed price update in the `parsed` field of each returned feed.
    #[serde(default = "default_true")]
    parsed: bool,

    /// If true, include the `metadata` field in the response with additional metadata about
    /// the price update.
    #[serde(default = "default_true")]
    verbose: bool,
}

fn default_true() -> bool {
    true
}

/// Get the latest price updates by price feed id.
///
/// Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.
#[utoipa::path(
    get,
    path = "/v2/updates/price/latest",
    responses(
        (status = 200, description = "Price updates retrieved successfully", body = Vec<RpcPriceFeed>)
    ),
    params(
        LatestPriceUpdatesQueryParams
    )
)]
pub async fn latest_price_updates(
    State(state): State<crate::api::ApiState>,
    QsQuery(params): QsQuery<LatestPriceUpdatesQueryParams>,
) -> Result<Json<Vec<PriceUpdate>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();

    verify_price_ids_exist(&state, &price_ids).await?;

    let price_feeds_with_update_data = crate::aggregate::get_price_feeds_with_update_data(
        &*state.state,
        &price_ids,
        RequestTime::Latest,
    )
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
                PriceUpdate::from_price_feed_update(
                    price_feed,
                    params.verbose,
                    params.parsed,
                    params.encoding,
                )
            })
            .collect(),
    ))
}
