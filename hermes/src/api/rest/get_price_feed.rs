use {
    crate::{
        api::{
            rest::RestError,
            types::{
                PriceIdInput,
                RpcPriceFeed,
            },
        },
        doc_examples,
        store::types::{
            RequestTime,
            UnixTimestamp,
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
pub struct GetPriceFeedQueryParams {
    /// The id of the price feed to get an update for.
    id: PriceIdInput,

    /// The unix timestamp in seconds. This endpoint will return the first update whose
    /// publish_time is >= the provided value.
    #[param(value_type = i64)]
    #[param(example = doc_examples::timestamp_example)]
    publish_time: UnixTimestamp,

    /// If true, include the `metadata` field in the response with additional metadata about the
    /// price update.
    #[serde(default)]
    verbose: bool,

    /// If true, include the binary price update in the `vaa` field of each returned feed. This
    /// binary data can be submitted to Pyth contracts to update the on-chain price.
    #[serde(default)]
    binary: bool,
}

/// Get a price update for a price feed with a specific timestamp
///
/// Given a price feed id and timestamp, retrieve the Pyth price update closest to that timestamp.
#[utoipa::path(
    get,
    path = "/api/get_price_feed",
    responses(
        (status = 200, description = "Price update retrieved successfully", body = RpcPriceFeed)
    ),
    params(
        GetPriceFeedQueryParams
    )
)]
pub async fn get_price_feed(
    State(state): State<crate::api::State>,
    QsQuery(params): QsQuery<GetPriceFeedQueryParams>,
) -> Result<Json<RpcPriceFeed>, RestError> {
    let price_id: PriceIdentifier = params.id.into();

    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(
            vec![price_id],
            RequestTime::FirstAfter(params.publish_time),
        )
        .await
        .map_err(|_| RestError::UpdateDataNotFound)?;

    let mut price_feed = price_feeds_with_update_data
        .price_feeds
        .into_iter()
        .next()
        .ok_or(RestError::UpdateDataNotFound)?;

    // Note: This is a hack to get around the fact that Benchmark doesn't give per price feed
    // update data. Since we request only for a single feed then the whole prices update data
    // is this price feed update data.
    price_feed.update_data = price_feeds_with_update_data.update_data.into_iter().next();

    Ok(Json(RpcPriceFeed::from_price_feed_update(
        price_feed,
        params.verbose,
        params.binary,
    )))
}
