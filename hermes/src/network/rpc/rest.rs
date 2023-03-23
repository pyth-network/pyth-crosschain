use {
    crate::{
        db::{
            Db,
            RequestTime,
        },
        proof_store::{
            Proof,
            ProofType,
        },
    },
    pyth_sdk::{
        PriceFeed,
        PriceIdentifier,
    },
};
// This file implements a REST service for the Price Service. This is a mostly direct copy of the
// TypeScript implementation in the `pyth-crosschain` repo. It uses `axum` as the web framework and
// `tokio` as the async runtime.
use {
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
};

pub enum RestError {
    InvalidPriceId,
    ProofNotFound,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::InvalidPriceId => {
                (StatusCode::BAD_REQUEST, "Invalid Price Id").into_response()
            }
            RestError::ProofNotFound => (StatusCode::NOT_FOUND, "Proof not found").into_response(),
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LatestVaaQueryParams {
    ids: Vec<String>,
}

/// REST endpoint /latest_vaas?ids[]=...&ids[]=...&ids[]=...
///
/// TODO: This endpoint returns proof as a byte array. We should probably return a base64 or hex string.
pub async fn latest_vaas(
    State(state): State<super::State<impl Db>>,
    Query(params): Query<LatestVaaQueryParams>,
) -> Result<Json<Proof>, RestError> {
    // TODO: Find better ways to validate query parameters.
    // FIXME: Handle ids with leading 0x
    let price_ids: Vec<PriceIdentifier> = params
        .ids
        .iter()
        .map(PriceIdentifier::from_hex)
        .collect::<Result<Vec<PriceIdentifier>, _>>()
        .map_err(|_| RestError::InvalidPriceId)?;
    let price_feeds_with_proof = state
        .proof_store
        .get_price_feeds_with_proof(ProofType::BatchVaa, price_ids, RequestTime::Latest)
        .map_err(|_| RestError::ProofNotFound)?;
    Ok(Json(price_feeds_with_proof.proof))
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LatestPriceFeedParams {
    ids: Vec<String>,
}

/// REST endpoint /latest_vaas?ids[]=...&ids[]=...&ids[]=...
pub async fn latest_price_feeds(
    State(state): State<super::State<impl Db>>,
    Query(params): Query<LatestPriceFeedParams>,
) -> Result<Json<Vec<PriceFeed>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params
        .ids
        .iter()
        .map(PriceIdentifier::from_hex)
        .collect::<Result<Vec<PriceIdentifier>, _>>()
        .map_err(|_| RestError::InvalidPriceId)?;
    let price_feeds_with_proof = state
        .proof_store
        .get_price_feeds_with_proof(ProofType::BatchVaa, price_ids, RequestTime::Latest)
        .map_err(|_| RestError::ProofNotFound)?;
    Ok(Json(
        price_feeds_with_proof.price_feeds.into_values().collect(),
    ))
}

// This function implements the `/live` endpoint. It returns a `200` status code. This endpoint is
// used by the Kubernetes liveness probe.
pub async fn live() -> Result<impl IntoResponse, std::convert::Infallible> {
    Ok(())
}

// This is the index page for the REST service. It will list all the available endpoints.
// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json(["/live", "/latest_price_feeds", "/latest_vaas"])
}
