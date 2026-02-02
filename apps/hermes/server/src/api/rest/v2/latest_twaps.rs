use {
    crate::{
        api::{
            rest::RestError,
            types::{EncodingType, PriceIdInput, TwapsResponse},
            ApiState,
        },
        state::aggregate::Aggregates,
    },
    anyhow::Result,
    axum::{
        extract::{Path, State},
        Json,
    },
    pyth_sdk::DurationInSeconds,
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
/// **DEPRECATED**: This endpoint has been deprecated and is no longer available.
#[utoipa::path(
    get,
    path = "/v2/updates/twap/{window_seconds}/latest",
    responses(
        (status = 400, description = "This endpoint has been deprecated", body = String)
    ),
    params(
        LatestTwapsPathParams,
        LatestTwapsQueryParams
    )
)]
pub async fn latest_twaps<S>(
    State(_state): State<ApiState<S>>,
    Path(_path_params): Path<LatestTwapsPathParams>,
    QsQuery(_params): QsQuery<LatestTwapsQueryParams>,
) -> Result<Json<TwapsResponse>, RestError>
where
    S: Aggregates,
{
    Err(RestError::DeprecatedEndpoint {
        message: "This endpoint has been deprecated and is no longer available.".to_string(),
    })
}
