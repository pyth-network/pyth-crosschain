use {
    super::types::{
        PriceIdInput,
        RpcPriceFeed,
        RpcPriceIdentifier,
    },
    crate::{
        impl_deserialize_for_hex_string_wrapper,
        store::types::{
            RequestTime,
            UnixTimestamp,
        },
    },
    anyhow::Result,
    axum::{
        extract::State,
        http::StatusCode,
        response::{
            IntoResponse,
            Response,
        },
        Json,
    },
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    derive_more::{
        Deref,
        DerefMut,
    },
    pyth_sdk::PriceIdentifier,
    serde_qs::axum::QsQuery,
    utoipa::{
        IntoParams,
        ToSchema,
    },
};

pub enum RestError {
    UpdateDataNotFound,
    CcipUpdateDataNotFound,
    InvalidCCIPInput,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::UpdateDataNotFound => {
                (StatusCode::NOT_FOUND, "Update data not found").into_response()
            }
            RestError::CcipUpdateDataNotFound => {
                // Returning Bad Gateway error because CCIP expects a 5xx error if it needs to
                // retry or try other endpoints. Bad Gateway seems the best choice here as this
                // is not an internal error and could happen on two scenarios:
                // 1. DB Api is not responding well (Bad Gateway is appropriate here)
                // 2. Publish time is a few seconds before current time and a VAA
                //    Will be available in a few seconds. So we want the client to retry.

                (StatusCode::BAD_GATEWAY, "CCIP update data not found").into_response()
            }
            RestError::InvalidCCIPInput => {
                (StatusCode::BAD_REQUEST, "Invalid CCIP input").into_response()
            }
        }
    }
}

/// Get the set of price feed ids.
///
/// Get all of the price feed ids for which price updates can be retrieved.
#[utoipa::path(
  get,
  path = "/api/price_feed_ids",
  responses(
    (status = 200, description = "Price feed ids retrieved successfully", body = Vec<RpcPriceIdentifier>)
  ),
  params()
)]
pub async fn price_feed_ids(
    State(state): State<super::State>,
) -> Result<Json<Vec<RpcPriceIdentifier>>, RestError> {
    let price_feed_ids = state
        .store
        .get_price_feed_ids()
        .await
        .iter()
        .map(|id| RpcPriceIdentifier::from(&id))
        .collect();
    Ok(Json(price_feed_ids))
}

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestVaasQueryParams {
    /// Get the VAAs for these price feed ids.
    /// Provide this parameter multiple times to retrieve multiple price updates,
    /// ids[]=a12...&ids[]=b4c...
    #[param(
        rename = "ids[]",
        example = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
    )]
    ids: Vec<PriceIdInput>,
}

/// Get VAAs for a set of price feed ids.
///
/// Given a collection of price feed ids, retrieve the latest VAA for them. The returned
/// VAA(s) can be submitted to the Pyth contract to update the on-chain price
#[utoipa::path(
  get,
  path = "/api/latest_vaas",
  responses(
    (status = 200, description = "VAAs retrieved successfully", body = Vec<String>)
  ),
  params(
    LatestVaasQueryParams
  )
)]
pub async fn latest_vaas(
    State(state): State<super::State>,
    QsQuery(params): QsQuery<LatestVaasQueryParams>,
) -> Result<Json<Vec<String>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();
    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(price_ids, RequestTime::Latest)
        .await
        .map_err(|_| RestError::UpdateDataNotFound)?;
    Ok(Json(
        price_feeds_with_update_data
            .wormhole_merkle_update_data
            .iter()
            .map(|bytes| base64_standard_engine.encode(bytes)) // TODO: Support multiple
            // encoding formats
            .collect(),
    ))
}

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestPriceFeedsQueryParams {
    /// Get the most recent price update for these price feed ids.
    /// Provide this parameter multiple times to retrieve multiple price updates,
    /// ids[]=a12...&ids[]=b4c...
    #[param(
        rename = "ids[]",
        example = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
    )]
    ids:     Vec<PriceIdInput>,
    /// If true, include the `metadata` field in the response with additional metadata about
    /// the price update.
    #[serde(default)]
    verbose: bool,
    /// If true, include the binary price update in the `vaa` field of each returned feed.
    /// This binary data can be submitted to Pyth contracts to update the on-chain price.
    #[serde(default)]
    binary:  bool,
}

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
pub async fn latest_price_feeds(
    State(state): State<super::State>,
    QsQuery(params): QsQuery<LatestPriceFeedsQueryParams>,
) -> Result<Json<Vec<RpcPriceFeed>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();
    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(price_ids, RequestTime::Latest)
        .await
        .map_err(|_| RestError::UpdateDataNotFound)?;
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

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct GetPriceFeedQueryParams {
    /// The id of the price feed to get an update for.
    id:           PriceIdInput,
    /// The unix timestamp in seconds. This endpoint will return the first update
    /// whose publish_time is >= the provided value.
    #[param(value_type = i64, example=1690576641)]
    publish_time: UnixTimestamp,
    /// If true, include the `metadata` field in the response with additional metadata about
    /// the price update.
    #[serde(default)]
    verbose:      bool,
    /// If true, include the binary price update in the `vaa` field of each returned feed.
    /// This binary data can be submitted to Pyth contracts to update the on-chain price.
    #[serde(default)]
    binary:       bool,
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
    State(state): State<super::State>,
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

    Ok(Json(RpcPriceFeed::from_price_feed_update(
        price_feeds_with_update_data
            .price_feeds
            .into_iter()
            .next()
            .ok_or(RestError::UpdateDataNotFound)?,
        params.verbose,
        params.binary,
    )))
}

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct GetVaaQueryParams {
    /// The id of the price feed to get an update for.
    id:           PriceIdInput,
    /// The unix timestamp in seconds. This endpoint will return the first update
    /// whose publish_time is >= the provided value.
    #[param(value_type = i64, example=1690576641)]
    publish_time: UnixTimestamp,
}

#[derive(Debug, serde::Serialize, ToSchema)]
pub struct GetVaaResponse {
    /// The VAA binary represented as a base64 string.
    vaa:          String,
    #[serde(rename = "publishTime")]
    #[schema(value_type = i64, example=1690576641)]
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
    State(state): State<super::State>,
    QsQuery(params): QsQuery<GetVaaQueryParams>,
) -> Result<Json<GetVaaResponse>, RestError> {
    let price_id: PriceIdentifier = params.id.into();

    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(
            vec![price_id],
            RequestTime::FirstAfter(params.publish_time),
        )
        .await
        .map_err(|_| RestError::UpdateDataNotFound)?;

    let vaa = price_feeds_with_update_data
        .wormhole_merkle_update_data
        .get(0)
        .map(|bytes| base64_standard_engine.encode(bytes))
        .ok_or(RestError::UpdateDataNotFound)?;

    let publish_time = price_feeds_with_update_data
        .price_feeds
        .get(0)
        .ok_or(RestError::UpdateDataNotFound)?
        .price_feed
        .publish_time;

    Ok(Json(GetVaaResponse { vaa, publish_time }))
}

#[derive(Debug, Clone, Deref, DerefMut, ToSchema)]
pub struct GetVaaCcipInput([u8; 40]);
impl_deserialize_for_hex_string_wrapper!(GetVaaCcipInput, 40);

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct GetVaaCcipQueryParams {
    data: GetVaaCcipInput,
}

#[derive(Debug, serde::Serialize, ToSchema)]
pub struct GetVaaCcipResponse {
    data: String, // TODO: Use a typed wrapper for the hex output with leading 0x.
}

/// Get a VAA for a price feed using CCIP
///
/// This endpoint accepts a single argument which is a hex-encoded byte string of the following form:
/// `<price feed id (32 bytes> <publish time as unix timestamp (8 bytes, big endian)>`
#[utoipa::path(
  get,
  path = "/api/get_vaa_ccip",
  responses(
    (status = 200, description = "Price update retrieved successfully", body = GetVaaCcipResponse)
  ),
  params(
    GetVaaCcipQueryParams
  )
)]
pub async fn get_vaa_ccip(
    State(state): State<super::State>,
    QsQuery(params): QsQuery<GetVaaCcipQueryParams>,
) -> Result<Json<GetVaaCcipResponse>, RestError> {
    let price_id: PriceIdentifier = PriceIdentifier::new(
        params.data[0..32]
            .try_into()
            .map_err(|_| RestError::InvalidCCIPInput)?,
    );
    let publish_time = UnixTimestamp::from_be_bytes(
        params.data[32..40]
            .try_into()
            .map_err(|_| RestError::InvalidCCIPInput)?,
    );

    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(vec![price_id], RequestTime::FirstAfter(publish_time))
        .await
        .map_err(|_| RestError::CcipUpdateDataNotFound)?;

    let bytes = price_feeds_with_update_data
        .wormhole_merkle_update_data
        .get(0) // One price feed has only a single VAA as proof.
        .ok_or(RestError::UpdateDataNotFound)?;

    Ok(Json(GetVaaCcipResponse {
        data: format!("0x{}", hex::encode(bytes)),
    }))
}

pub async fn live() -> Response {
    (StatusCode::OK, "OK").into_response()
}

pub async fn ready(State(state): State<super::State>) -> Response {
    match state.store.is_ready().await {
        true => (StatusCode::OK, "OK").into_response(),
        false => (StatusCode::SERVICE_UNAVAILABLE, "Service Unavailable").into_response(),
    }
}

// This is the index page for the REST service. It will list all the available endpoints.
// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json([
        "/live",
        "/ready",
        "/api/price_feed_ids",
        "/api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&verbose=true)(&binary=true)",
        "/api/latest_vaas?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&...",
        "/api/get_price_feed?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>(&verbose=true)(&binary=true)",
        "/api/get_vaa?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>",
        "/api/get_vaa_ccip?data=<0x<price_feed_id_32_bytes>+<publish_time_unix_timestamp_be_8_bytes>>",
    ])
}
