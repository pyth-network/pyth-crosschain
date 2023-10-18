use {
    crate::api::{
        ChainId,
        RestError,
    },
    anyhow::Result,
    axum::{
        extract::{
            Path,
            State,
        },
        Json,
    },
    pythnet_sdk::wire::array,
    utoipa::{
        IntoParams,
        ToSchema,
    },
};

// TODO: this should probably take path parameters /v1/revelation/<chain_id>/<sequence_number>
/// Reveal the random value for a given sequence number and blockchain.
///
/// Given a sequence number, retrieve the corresponding random value that this provider has committed to.
/// This endpoint will not return the random value unless someone has requested the sequence number on-chain.
///
/// Every blockchain supported by this service has a distinct sequence of random numbers and chain_id.
/// Callers must pass the appropriate chain_id to ensure they fetch the correct random number.
#[utoipa::path(
get,
path = "/v1/chains/{chain_id}/revelations/{sequence}",
responses(
(status = 200, description = "Random value successfully retrieved", body = GetRandomValueResponse),
(status = 403, description = "Random value cannot currently be retrieved", body = String)
),
params(GetRandomValueQueryParams)
)]
pub async fn revelation(
    State(state): State<crate::api::ApiState>,
    Path(GetRandomValueQueryParams { chain_id, sequence }): Path<GetRandomValueQueryParams>,
) -> Result<Json<GetRandomValueResponse>, RestError> {
    let sequence: u64 = sequence
        .try_into()
        .map_err(|_| RestError::InvalidSequenceNumber)?;

    let state = state
        .chains
        .get(&chain_id)
        .ok_or_else(|| RestError::InvalidChainId)?;

    let r = state
        .contract
        .get_request(state.provider_address, sequence)
        .call()
        .await
        .map_err(|_| RestError::TemporarilyUnavailable)?;

    // sequence_number == 0 means the request does not exist.
    if r.sequence_number != 0 {
        let value = &state
            .state
            .reveal(sequence)
            .map_err(|_| RestError::Unknown)?;
        Ok(Json(GetRandomValueResponse {
            value: (*value).clone(),
        }))
    } else {
        Err(RestError::NoPendingRequest)
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Path)]
pub struct GetRandomValueQueryParams {
    #[param(value_type = String)]
    pub chain_id: ChainId,
    pub sequence: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct GetRandomValueResponse {
    // TODO: choose serialization format
    #[serde(with = "array")]
    pub value: [u8; 32],
}
