use {
    crate::api::{ChainId, RequestLabel, RestError},
    anyhow::Result,
    axum::{
        extract::{Path, Query, State},
        Json,
    },
    tokio::try_join,
    utoipa::{IntoParams, ToSchema},
};

/// Get price update data for a given sequence number and blockchain.
///
/// Given a sequence number, retrieve the corresponding price update data that this provider can deliver.
/// This endpoint will not return the price data unless someone has requested the sequence number on-chain.
///
/// Every blockchain supported by this service has a distinct sequence of price updates and chain_id.
/// Callers must pass the appropriate chain_id to ensure they fetch the correct price data.
#[utoipa::path(
get,
path = "/v1/chains/{chain_id}/price-updates/{sequence}",
responses(
(status = 200, description = "Price update data successfully retrieved", body = GetPriceUpdateResponse),
(status = 403, description = "Price update data cannot currently be retrieved", body = String)
),
params(PriceUpdatePathParams, PriceUpdateQueryParams)
)]
pub async fn price_update(
    State(state): State<crate::api::ApiState>,
    Path(PriceUpdatePathParams { chain_id, sequence }): Path<PriceUpdatePathParams>,
    Query(PriceUpdateQueryParams { format }): Query<PriceUpdateQueryParams>,
) -> Result<Json<GetPriceUpdateResponse>, RestError> {
    let _ = format; // Ignore the unused variable

    state
        .metrics
        .http_requests
        .get_or_create(&RequestLabel {
            value: "/v1/chains/{chain_id}/price-updates/{sequence}".to_string(),
        })
        .inc();

    let state = state
        .chains
        .get(&chain_id)
        .ok_or(RestError::InvalidChainId)?;

    let maybe_request_fut = state.contract.get_request(sequence);

    let current_block_number_fut = state
        .contract
        .get_block_number(state.confirmed_block_status);

    let (maybe_request, _current_block_number) =
        try_join!(maybe_request_fut, current_block_number_fut).map_err(|e| {
            tracing::error!(chain_id = chain_id, "RPC request failed {}", e);
            RestError::TemporarilyUnavailable
        })?;

    match maybe_request {
        Some(request) => {
            // In a real implementation, we would fetch the price update data from a data source
            // For now, we'll just return a mock response
            let price_update_data =
                generate_price_update_data(&request.price_ids, request.publish_time.as_u64());

            Ok(Json(GetPriceUpdateResponse {
                data: PriceUpdateData::new(price_update_data),
            }))
        }
        None => Err(RestError::NoPendingRequest),
    }
}

// Helper function to generate price update data based on price IDs and publish time
// In a real implementation, this would fetch actual price data from a data source
fn generate_price_update_data(price_ids: &[[u8; 32]], publish_time: u64) -> Vec<u8> {
    // This is just a placeholder implementation
    // In a real system, we would generate actual price update data
    let mut data = Vec::new();

    // Add publish time to the data
    data.extend_from_slice(&publish_time.to_be_bytes());

    // Add a simple representation of each price ID
    for price_id in price_ids {
        data.extend_from_slice(price_id);
    }

    data
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Path)]
pub struct PriceUpdatePathParams {
    #[param(value_type = String)]
    pub chain_id: ChainId,
    pub sequence: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct PriceUpdateQueryParams {
    pub format: Option<ResponseFormat>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum ResponseFormat {
    #[serde(rename = "json")]
    Json,
    #[serde(rename = "binary")]
    Binary,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct GetPriceUpdateResponse {
    pub data: PriceUpdateData,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct PriceUpdateData {
    data: Vec<u8>,
}

impl PriceUpdateData {
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }
}
