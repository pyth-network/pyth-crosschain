use {
    super::validate_price_ids,
    crate::{
        api::{doc_examples, rest::RestError, types::PriceIdInput, ApiState},
        state::aggregate::{Aggregates, RequestTime, UnixTimestamp},
    },
    anyhow::Result,
    axum::{extract::State, Json},
    base64::{engine::general_purpose::STANDARD as base64_standard_engine, Engine as _},
    pyth_sdk::PriceIdentifier,
    serde_qs::axum::QsQuery,
    utoipa::{IntoParams, ToSchema},
};

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct GetVaaQueryParams {
    /// The ID of the price feed to get an update for.
    id: PriceIdInput,

    /// The unix timestamp in seconds. This endpoint will return the first update whose
    /// publish_time is >= the provided value.
    #[param(value_type = i64)]
    #[param(example = 1690576641)]
    publish_time: UnixTimestamp,
}

#[derive(Debug, serde::Serialize, ToSchema)]
pub struct GetVaaResponse {
    /// The VAA binary represented as a base64 string.
    #[schema(example = doc_examples::vaa_example)]
    vaa: String,

    #[serde(rename = "publishTime")]
    #[schema(value_type = i64)]
    #[schema(example = 1690576641)]
    publish_time: UnixTimestamp,
}

/// **Deprecated: use /v2/updates/price/{publish_time} instead**
///
/// Get a VAA for a price feed with a specific timestamp
///
/// Given a price feed id and timestamp, retrieve the Pyth price update closest to that timestamp.
#[utoipa::path(
    get,
    path = "/api/get_vaa",
    responses(
        (status = 200, description = "Price update retrieved successfully", body = GetVaaResponse),
        (status = 404, description = "Price update not found", body = String)
    ),
    params(
        GetVaaQueryParams
    )
)]
#[deprecated]
pub async fn get_vaa<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<GetVaaQueryParams>,
) -> Result<Json<GetVaaResponse>, RestError>
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

    let vaa = price_feeds_with_update_data
        .update_data
        .first()
        .map(|bytes| base64_standard_engine.encode(bytes))
        .ok_or(RestError::UpdateDataNotFound)?;

    let price_feed = price_feeds_with_update_data
        .price_feeds
        .into_iter()
        .next()
        .ok_or(RestError::UpdateDataNotFound)?;

    let publish_time = price_feed.price_feed.get_price_unchecked().publish_time;

    // Currently Benchmarks API doesn't support returning the previous publish time. So we
    // are assuming that it is doing the same filter as us and returns not found if the
    // price update is not unique.
    if let Some(prev_publish_time) = price_feed.prev_publish_time {
        if prev_publish_time == price_feed.price_feed.get_price_unchecked().publish_time {
            return Err(RestError::BenchmarkPriceNotUnique);
        }
    }

    Ok(Json(GetVaaResponse { vaa, publish_time }))
}
