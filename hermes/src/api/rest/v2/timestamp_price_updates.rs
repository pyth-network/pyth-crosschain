use {
    crate::{
        aggregate::{
            RequestTime,
            UnixTimestamp,
        },
        api::{
            doc_examples,
            rest::{
                verify_price_ids_exist,
                RestError,
            },
            types::{
                BinaryPriceUpdate,
                EncodingType,
                ParsedPriceUpdate,
                PriceIdInput,
                PriceUpdate,
            },
        },
    },
    anyhow::Result,
    axum::{
        extract::{
            Path,
            State,
        },
        Json,
    },
    pyth_sdk::PriceIdentifier,
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in=Path)]
pub struct TimestampPriceUpdatesPathParams {
    /// The unix timestamp in seconds. This endpoint will return the first update whose
    /// publish_time is >= the provided value.
    #[param(value_type = i64)]
    #[param(example = doc_examples::timestamp_example)]
    publish_time: UnixTimestamp,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct TimestampPriceUpdatesQueryParams {
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
}


fn default_true() -> bool {
    true
}

/// Get the latest price updates by price feed id.
///
/// Given a collection of price feed ids, retrieve the latest Pyth price for each price feed.
#[utoipa::path(
    get,
    path = "/v2/updates/price/{publish_time}",
    responses(
        (status = 200, description = "Price updates retrieved successfully", body = Vec<PriceUpdate>),
        (status = 404, description = "Price ids not found", body = String)
    ),
    params(
        TimestampPriceUpdatesPathParams,
        TimestampPriceUpdatesQueryParams
    )
)]
pub async fn timestamp_price_updates(
    State(state): State<crate::api::ApiState>,
    Path(path_params): Path<TimestampPriceUpdatesPathParams>,
    QsQuery(query_params): QsQuery<TimestampPriceUpdatesQueryParams>,
) -> Result<Json<Vec<PriceUpdate>>, RestError> {
    let price_ids: Vec<PriceIdentifier> =
        query_params.ids.into_iter().map(|id| id.into()).collect();

    verify_price_ids_exist(&state, &price_ids).await?;

    let price_feeds_with_update_data = crate::aggregate::get_price_feeds_with_update_data(
        &*state.state,
        &price_ids,
        RequestTime::FirstAfter(path_params.publish_time),
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

    let price_update_data = price_feeds_with_update_data.update_data;
    let encoded_data: Vec<String> = price_update_data
        .into_iter()
        .map(|data| query_params.encoding.encode_str(&data))
        .collect();
    let binary_price_update = BinaryPriceUpdate {
        encoding: query_params.encoding,
        data:     encoded_data,
    };
    let parsed_price_updates: Option<Vec<ParsedPriceUpdate>> = if query_params.parsed {
        Some(
            price_feeds_with_update_data
                .price_feeds
                .into_iter()
                .map(|price_feed| price_feed.into())
                .collect(),
        )
    } else {
        None
    };

    let compressed_price_update = PriceUpdate {
        binary: binary_price_update,
        parsed: parsed_price_updates,
    };


    Ok(Json(vec![compressed_price_update]))
}
