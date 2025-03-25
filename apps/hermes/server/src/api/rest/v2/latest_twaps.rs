use {
    crate::{
        api::{
            rest::{validate_price_ids, RestError},
            types::{BinaryUpdate, EncodingType, ParsedPriceFeedTwap, PriceIdInput, TwapsResponse},
            ApiState,
        },
        state::aggregate::{Aggregates, RequestTime},
    },
    anyhow::Result,
    axum::{
        extract::{Path, State},
        Json,
    },
    base64::{engine::general_purpose::STANDARD as base64_standard_engine, Engine as _},
    pyth_sdk::{DurationInSeconds, PriceIdentifier},
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in=Path)]
pub struct LatestTwapsPathParams {
    /// The time window in seconds over which to calculate the TWAP, ending at the current time.
    /// For example, a value of 300 would return the most recent 5 minute TWAP.
    /// Must be greater than 0 and less than or equal to 600 seconds (10 minutes).
    #[param(example = "300")]
    #[serde(deserialize_with = "validate_twap_window")]
    window_seconds: u64,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestTwapsQueryParams {
    /// Get the most recent TWAP (time weighted average price) for this set of price feed ids.
    /// The `binary` data contains the signed start & end cumulative price updates needed to calculate
    /// the TWAPs on-chain. The `parsed` data contains the calculated TWAPs.
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

    /// Optional encoding type. If true, return the cumulative price updates in the encoding specified by the encoding parameter. Default is `hex`.
    #[serde(default)]
    encoding: EncodingType,

    /// If true, include the calculated TWAP in the `parsed` field of each returned feed. Default is `true`.
    #[serde(default = "default_true")]
    parsed: bool,

    /// If true, invalid price IDs in the `ids` parameter are ignored. Only applicable to the v2 APIs. Default is `false`.
    #[serde(default)]
    ignore_invalid_price_ids: bool,
}

fn validate_twap_window<'de, D>(deserializer: D) -> Result<DurationInSeconds, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error;
    let seconds = DurationInSeconds::deserialize(deserializer)?;
    if seconds == 0 || seconds > 600 {
        return Err(D::Error::custom(
            "twap_window_seconds must be in range (0, 600]",
        ));
    }
    Ok(seconds)
}
fn default_true() -> bool {
    true
}

/// Get the latest TWAP by price feed id with a custom time window.
///
/// Given a collection of price feed ids, retrieve the latest Pyth TWAP price for each price feed.
#[utoipa::path(
    get,
    path = "/v2/updates/twap/{window_seconds}/latest",
    responses(
        (status = 200, description = "TWAPs retrieved successfully", body = TwapsResponse),
        (status = 404, description = "Price ids not found", body = String)
    ),
    params(
        LatestTwapsPathParams,
        LatestTwapsQueryParams
    )
)]
pub async fn latest_twaps<S>(
    State(state): State<ApiState<S>>,
    Path(path_params): Path<LatestTwapsPathParams>,
    QsQuery(params): QsQuery<LatestTwapsQueryParams>,
) -> Result<Json<TwapsResponse>, RestError>
where
    S: Aggregates,
{
    let price_id_inputs: Vec<PriceIdentifier> =
        params.ids.into_iter().map(|id| id.into()).collect();
    let price_ids: Vec<PriceIdentifier> =
        validate_price_ids(&state, &price_id_inputs, params.ignore_invalid_price_ids).await?;

    // Calculate the average
    let twaps_with_update_data = Aggregates::get_twaps_with_update_data(
        &*state.state,
        &price_ids,
        path_params.window_seconds,
        RequestTime::LatestTimeEarliestSlot,
    )
    .await
    .map_err(|e| {
        tracing::warn!(
            "Error getting TWAPs for price IDs {:?} with update data: {:?}",
            price_ids,
            e
        );
        RestError::UpdateDataNotFound
    })?;

    let twap_update_data = twaps_with_update_data.update_data;
    let encoded_data = twap_update_data
        .into_iter()
        .map(|data| match params.encoding {
            EncodingType::Base64 => base64_standard_engine.encode(data),
            EncodingType::Hex => hex::encode(data),
        })
        .collect();
    let binary = BinaryUpdate {
        encoding: params.encoding,
        data: encoded_data,
    };

    let parsed: Option<Vec<ParsedPriceFeedTwap>> = if params.parsed {
        Some(
            twaps_with_update_data
                .twaps
                .into_iter()
                .map(Into::into)
                .collect(),
        )
    } else {
        None
    };

    let twap_resp = TwapsResponse { binary, parsed };
    Ok(Json(twap_resp))
}
