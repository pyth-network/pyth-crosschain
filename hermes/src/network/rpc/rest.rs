use {
    crate::store::RequestTime,
    crate::{
        impl_deserialize_for_hex_string_wrapper,
        store::UnixTimestamp,
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
    axum_extra::extract::Query, // Axum extra Query allows us to parse multi-value query parameters.
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    derive_more::{
        Deref,
        DerefMut,
    },
    pyth_sdk::{
        PriceFeed,
        PriceIdentifier,
    },
};

#[derive(Debug, Clone, Deref, DerefMut)]
pub struct PriceIdInput([u8; 32]);
impl_deserialize_for_hex_string_wrapper!(PriceIdInput, 32);

impl From<PriceIdInput> for PriceIdentifier {
    fn from(id: PriceIdInput) -> Self {
        Self::new(*id)
    }
}

pub enum RestError {
    UpdateDataNotFound,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::UpdateDataNotFound => {
                (StatusCode::NOT_FOUND, "Update data not found").into_response()
            }
        }
    }
}


#[derive(Debug, serde::Deserialize)]
pub struct LatestVaasQueryParams {
    ids: Vec<PriceIdInput>,
}


pub async fn latest_vaas(
    State(state): State<super::State>,
    Query(params): Query<LatestVaasQueryParams>,
) -> Result<Json<Vec<String>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();
    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(price_ids, RequestTime::Latest)
        .map_err(|_| RestError::UpdateDataNotFound)?;
    Ok(Json(
        price_feeds_with_update_data
            .update_data
            .batch_vaa
            .iter()
            .map(|vaa_bytes| base64_standard_engine.encode(vaa_bytes)) // TODO: Support multiple
            // encoding formats
            .collect(),
    ))
}

#[derive(Debug, serde::Deserialize)]
pub struct LatestPriceFeedsQueryParams {
    ids: Vec<PriceIdInput>,
}

pub async fn latest_price_feeds(
    State(state): State<super::State>,
    Query(params): Query<LatestPriceFeedsQueryParams>,
) -> Result<Json<Vec<PriceFeed>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();
    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(price_ids, RequestTime::Latest)
        .map_err(|_| RestError::UpdateDataNotFound)?;
    Ok(Json(
        price_feeds_with_update_data
            .price_feeds
            .into_values()
            .collect(),
    ))
}

#[derive(Debug, serde::Deserialize)]
pub struct GetVaaQueryParams {
    id:           PriceIdInput,
    publish_time: UnixTimestamp,
}

#[derive(Debug, serde::Serialize)]
pub struct GetVaaResponse {
    pub vaa:          String,
    #[serde(rename = "publishTime")]
    pub publish_time: UnixTimestamp,
}

pub async fn get_vaa(
    State(state): State<super::State>,
    Query(params): Query<GetVaaQueryParams>,
) -> Result<Json<GetVaaResponse>, RestError> {
    let price_id: PriceIdentifier = params.id.into();

    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(
            vec![price_id],
            RequestTime::FirstAfter(params.publish_time),
        )
        .map_err(|_| RestError::UpdateDataNotFound)?;

    let vaa = price_feeds_with_update_data
        .update_data
        .batch_vaa
        .get(0)
        .map(|vaa_bytes| base64_standard_engine.encode(vaa_bytes))
        .ok_or(RestError::UpdateDataNotFound)?;

    let publish_time = price_feeds_with_update_data
        .price_feeds
        .get(&price_id)
        .map(|price_feed| price_feed.get_price_unchecked().publish_time)
        .ok_or(RestError::UpdateDataNotFound)?;
    let publish_time: UnixTimestamp = publish_time
        .try_into()
        .map_err(|_| RestError::UpdateDataNotFound)?;

    Ok(Json(GetVaaResponse { vaa, publish_time }))
}

#[derive(Debug, Clone, Deref, DerefMut)]
pub struct GetVaaCcipInput([u8; 40]);
impl_deserialize_for_hex_string_wrapper!(GetVaaCcipInput, 40);

#[derive(Debug, serde::Deserialize)]
pub struct GetVaaCcipQueryParams {
    data: GetVaaCcipInput,
}

#[derive(Debug, serde::Serialize)]
pub struct GetVaaCcipResponse {
    data: String,
}

pub async fn get_vaa_ccip(
    State(state): State<super::State>,
    Query(params): Query<GetVaaCcipQueryParams>,
) -> Result<Json<GetVaaCcipResponse>, RestError> {
    let price_id: PriceIdentifier = PriceIdentifier::new(params.data[0..32].try_into().unwrap());
    let publish_time = UnixTimestamp::from_be_bytes(params.data[32..40].try_into().unwrap());

    let price_feeds_with_update_data = state
        .store
        .get_price_feeds_with_update_data(vec![price_id], RequestTime::FirstAfter(publish_time))
        .map_err(|_| RestError::UpdateDataNotFound)?;

    let vaa = price_feeds_with_update_data
        .update_data
        .batch_vaa
        .get(0)
        .ok_or(RestError::UpdateDataNotFound)?;

    // FIXME: We should return 5xx when the vaa is not found and 4xx when the price id is not there

    Ok(Json(GetVaaCcipResponse {
        data: format!("0x{}", hex::encode(vaa)),
    }))
}

// This function implements the `/live` endpoint. It returns a `200` status code. This endpoint is
// used by the Kubernetes liveness probe.
pub async fn live() -> Result<impl IntoResponse, std::convert::Infallible> {
    Ok(())
}

// This is the index page for the REST service. It will list all the available endpoints.
// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json([
        "/live",
        "/api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..",
        "/api/latest_vaas?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&...",
        "/api/get_vaa?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>",
        "/api/get_vaa_ccip?data=<0x<price_feed_id_32_bytes>+<publish_time_unix_timestamp_be_8_bytes>>",
    ])
}
