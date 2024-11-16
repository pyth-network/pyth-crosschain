use {
    super::validate_price_ids,
    crate::{
        api::{
            doc_examples,
            rest::RestError,
            types::{PriceIdInput, RpcPriceFeed},
            ApiState,
        },
        state::aggregate::{Aggregates, RequestTime, UnixTimestamp},
    },
    anyhow::Result,
    axum::{extract::State, Json},
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

/// **Deprecated: use /v2/updates/price/{publish_time} instead**
///
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
#[deprecated]
pub async fn get_price_feed<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<GetPriceFeedQueryParams>,
) -> Result<Json<RpcPriceFeed>, RestError>
where
    S: Aggregates,
{
    let price_id: PriceIdentifier = params.id.into();
    validate_price_ids(&state, &[price_id], false).await?;

    let state = &*state.state;
    let price_feeds_with_update_data = Aggregates::get_price_feeds_with_update_data(
        state,
        &[price_id],
        RequestTime::FirstAfter(params.publish_time),
    )
    .await
    .map_err(|e| {
        tracing::warn!(
            "Error getting price feed {:?} with update data: {:?}",
            price_id,
            e
        );
        RestError::UpdateDataNotFound
    })?;

    let mut price_feed = price_feeds_with_update_data
        .price_feeds
        .into_iter()
        .next()
        .ok_or(RestError::UpdateDataNotFound)?;

    // Currently Benchmarks API doesn't support returning the previous publish time. So we
    // are assuming that it is doing the same filter as us and returns not found if the
    // price update is not unique.
    if let Some(prev_publish_time) = price_feed.prev_publish_time {
        if prev_publish_time == price_feed.price_feed.get_price_unchecked().publish_time {
            return Err(RestError::BenchmarkPriceNotUnique);
        }
    }

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
