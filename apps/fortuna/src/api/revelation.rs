use {
    crate::{
        api::{examples, ApiBlockChainState, ChainId, RequestLabel, RestError},
        chain::reader::BlockNumber,
    },
    anyhow::Result,
    axum::{
        extract::{Path, Query, State},
        Json,
    },
    pythnet_sdk::wire::array,
    serde_with::serde_as,
    tokio::try_join,
    utoipa::{IntoParams, ToSchema},
};

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
(status = 200, description = "Random value successfully retrieved", body = GetRandomValueResponse,
    example = json!({
        "encoding": "hex",
        "data": "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe"
    })
),
(status = 403, description = "Random value cannot currently be retrieved", body = String,
    example = json!("The request with the given sequence number has not been made yet, or the random value has already been revealed on chain.")
)
),
params(RevelationPathParams, RevelationQueryParams)
)]
pub async fn revelation(
    State(state): State<crate::api::ApiState>,
    Path(RevelationPathParams { chain_id, sequence }): Path<RevelationPathParams>,
    Query(RevelationQueryParams {
        encoding,
        block_number,
    }): Query<RevelationQueryParams>,
) -> Result<Json<GetRandomValueResponse>, RestError> {
    state
        .metrics
        .http_requests
        .get_or_create(&RequestLabel {
            value: "/v1/chains/{chain_id}/revelations/{sequence}".to_string(),
        })
        .inc();

    let state = state
        .chains
        .read()
        .await
        .get(&chain_id)
        .ok_or(RestError::InvalidChainId)?
        .clone();

    let state = match state {
        ApiBlockChainState::Initialized(state) => state,
        ApiBlockChainState::Uninitialized => {
            return Err(RestError::Uninitialized);
        }
    };

    let current_block_number_fut = state
        .contract
        .get_block_number(state.confirmed_block_status);

    match block_number {
        Some(block_number) => {
            let maybe_request_fut = state.contract.get_request_with_callback_events(
                block_number,
                block_number,
                state.provider_address,
            );

            let (maybe_request, current_block_number) =
                try_join!(maybe_request_fut, current_block_number_fut).map_err(|e| {
                    tracing::error!(chain_id = chain_id, "RPC request failed {}", e);
                    RestError::TemporarilyUnavailable
                })?;

            if current_block_number.saturating_sub(state.reveal_delay_blocks) < block_number {
                return Err(RestError::PendingConfirmation);
            }

            maybe_request
                .iter()
                .find(|r| r.sequence_number == sequence)
                .ok_or(RestError::NoPendingRequest)?;
        }
        None => {
            let maybe_request_fut = state
                .contract
                .get_request_v2(state.provider_address, sequence);
            let (maybe_request, current_block_number) =
                try_join!(maybe_request_fut, current_block_number_fut).map_err(|e| {
                    tracing::error!(chain_id = chain_id, "RPC request failed {}", e);
                    RestError::TemporarilyUnavailable
                })?;

            match maybe_request {
                Some(r)
                    if current_block_number.saturating_sub(state.reveal_delay_blocks)
                        >= r.block_number =>
                {
                    Ok(())
                }
                Some(_) => Err(RestError::PendingConfirmation),
                None => Err(RestError::NoPendingRequest),
            }?;
        }
    }

    let value = &state.state.reveal(sequence).map_err(|e| {
        tracing::error!(
            chain_id = chain_id,
            sequence = sequence,
            "Reveal failed {}",
            e
        );
        RestError::Unknown
    })?;
    let encoded_value = Blob::new(encoding.unwrap_or(BinaryEncoding::Hex), *value);

    Ok(Json(GetRandomValueResponse {
        value: encoded_value,
    }))
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Path)]
pub struct RevelationPathParams {
    /// The unique identifier for the blockchain (e.g., "ethereum", "avalanche")
    #[param(value_type = String, example = examples::chain_id_example)]
    pub chain_id: ChainId,
    /// The sequence number of the random value request
    #[param(example = examples::sequence_example)]
    pub sequence: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct RevelationQueryParams {
    /// The encoding format for the random value (hex, base64, or array)
    #[param(example = examples::encoding_example)]
    pub encoding: Option<BinaryEncoding>,
    /// Optional block number to verify the request was made at a specific block
    #[param(value_type = Option<u64>, example = examples::block_number_example)]
    pub block_number: Option<BlockNumber>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
#[schema(example = "hex")]
pub enum BinaryEncoding {
    /// Hexadecimal encoding (default)
    #[serde(rename = "hex")]
    Hex,
    /// Base64 encoding
    #[serde(rename = "base64")]
    Base64,
    /// Raw byte array encoding
    #[serde(rename = "array")]
    Array,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct GetRandomValueResponse {
    /// The random value in the requested encoding format
    pub value: Blob,
}

#[serde_as]
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
#[serde(tag = "encoding", rename_all = "kebab-case")]
pub enum Blob {
    /// Random value encoded as hexadecimal string
    Hex {
        /// The 32-byte random value as a hex string
        #[serde_as(as = "serde_with::hex::Hex")]
        #[schema(example = "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe")]
        data: [u8; 32],
    },
    /// Random value encoded as base64 string
    Base64 {
        /// The 32-byte random value as a base64 string
        #[serde_as(as = "serde_with::base64::Base64")]
        #[schema(example = "qQWrVlZ9MafaOO2BnZe8JX8z6+OFxccszibju4VfD+4=")]
        data: [u8; 32],
    },
    /// Random value as a raw byte array
    Array {
        /// The 32-byte random value as an array of integers
        #[serde(with = "array")]
        data: [u8; 32],
    },
}

impl Blob {
    pub fn new(encoding: BinaryEncoding, data: [u8; 32]) -> Blob {
        match encoding {
            BinaryEncoding::Hex => Blob::Hex { data },
            BinaryEncoding::Base64 => Blob::Base64 { data },
            BinaryEncoding::Array => Blob::Array { data },
        }
    }

    pub fn data(&self) -> &[u8; 32] {
        match self {
            Blob::Hex { data } => data,
            Blob::Base64 { data } => data,
            Blob::Array { data } => data,
        }
    }
}
