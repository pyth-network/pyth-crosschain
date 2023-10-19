use {
    super::verify_price_ids_exist,
    crate::{
        aggregate::{
            get_price_feeds_with_update_data,
            RequestTime,
            UnixTimestamp,
        },
        api::{
            doc_examples,
            rest::RestError,
            types::PriceIdInput,
        },
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    pyth_sdk::PriceIdentifier,
    serde_qs::axum::QsQuery,
    utoipa::{
        IntoParams,
        ToSchema,
    },
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
pub async fn get_vaa(
    State(state): State<crate::api::ApiState>,
    QsQuery(params): QsQuery<GetVaaQueryParams>,
) -> Result<Json<GetVaaResponse>, RestError> {
    let price_id: PriceIdentifier = params.id.into();

    verify_price_ids_exist(&state, &[price_id]).await?;

    let price_feeds_with_update_data = get_price_feeds_with_update_data(
        &*state.state,
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
        .get(0)
        .map(|bytes| base64_standard_engine.encode(bytes))
        .ok_or(RestError::UpdateDataNotFound)?;

    let publish_time = price_feeds_with_update_data
        .price_feeds
        .get(0)
        .ok_or(RestError::UpdateDataNotFound)?
        .price_feed
        .get_price_unchecked()
        .publish_time;

    Ok(Json(GetVaaResponse { vaa, publish_time }))
}
