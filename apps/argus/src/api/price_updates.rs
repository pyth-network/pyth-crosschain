use {
    crate::api::{ChainId, RequestLabel, RestError},
    anyhow::Result,
    axum::{
        extract::{Path, Query, State},
        Json,
    },
    serde_with::serde_as,
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
pub async fn price_updates(
    State(state): State<crate::api::ApiState>,
    Path(PriceUpdatePathParams { chain_id, sequence }): Path<PriceUpdatePathParams>,
    Query(PriceUpdateQueryParams { format }): Query<PriceUpdateQueryParams>,
) -> Result<Json<GetPriceUpdateResponse>, RestError> {
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

    let (maybe_request, current_block_number) =
        try_join!(maybe_request_fut, current_block_number_fut).map_err(|e| {
            tracing::error!(chain_id = chain_id, "RPC request failed {}", e);
            RestError::TemporarilyUnavailable
        })?;

    match maybe_request {
        Some(r)
            if current_block_number.saturating_sub(state.update_delay_blocks) >= r.block_number =>
        {
            // Get the price update data for the requested price IDs
            let update_data = state.state.get_price_update_data(&r.price_ids).map_err(|e| {
                tracing::error!(
                    chain_id = chain_id,
                    sequence = sequence,
                    "Price update data retrieval failed {}",
                    e
                );
                RestError::Unknown
            })?;

            // Format the response based on the requested format
            let response_format = format.unwrap_or(ResponseFormat::Json);

            Ok(Json(GetPriceUpdateResponse {
                sequence_number: sequence,
                price_ids: r.price_ids.iter().map(|id| format!("0x{}", hex::encode(id))).collect(),
                update_data: match response_format {
                    ResponseFormat::Json => PriceUpdateData::Json {
                        data: update_data.iter().map(|data| {
                            serde_json::to_value(data).unwrap_or_default()
                        }).collect()
                    },
                    ResponseFormat::Binary => PriceUpdateData::Binary {
                        data: update_data.iter().map(|data| {
                            data.clone()
                        }).collect()
                    },
                },
                publish_time: r.publish_time.as_u64(),
            }))
        }
        Some(_) => Err(RestError::PendingConfirmation),
        None => Err(RestError::NoPendingRequest),
    }
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

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct GetPriceUpdateResponse {
    pub sequence_number: u64,
    pub price_ids: Vec<String>,
    pub update_data: PriceUpdateData,
    pub publish_time: u64,
}

#[serde_as]
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
#[serde(tag = "format", rename_all = "kebab-case")]
pub enum PriceUpdateData {
    Json {
        data: Vec<serde_json::Value>,
    },
    Binary {
        #[serde_as(as = "Vec<serde_with::base64::Base64>")]
        data: Vec<Vec<u8>>,
    },
}
