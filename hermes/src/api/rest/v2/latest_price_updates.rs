use {
    crate::{
        aggregate::RequestTime,
        api::{
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
        extract::State,
        Json,
    },
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    pyth_sdk::PriceIdentifier,
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};


#[derive(Debug, Deserialize, IntoParams)]
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
        (status = 200, description = "Price updates retrieved successfully", body = PriceUpdate),
        (status = 404, description = "Price ids not found", body = String)
    ),
    params(
        LatestPriceUpdatesQueryParams
    )
)]
pub async fn latest_price_updates(
    State(state): State<crate::api::ApiState>,
    QsQuery(params): QsQuery<LatestPriceUpdatesQueryParams>,
) -> Result<Json<PriceUpdate>, RestError> {
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

    let price_update_data = price_feeds_with_update_data.update_data;
    let encoded_data: Vec<String> = price_update_data
        .into_iter()
        .map(|data| match params.encoding {
            EncodingType::Base64 => base64_standard_engine.encode(data),
            EncodingType::Hex => hex::encode(data),
        })
        .collect();
    let binary_price_update = BinaryPriceUpdate {
        encoding: params.encoding,
        data:     encoded_data,
    };
    let parsed_price_updates: Option<Vec<ParsedPriceUpdate>> = if params.parsed {
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


    Ok(Json(compressed_price_update))
}
