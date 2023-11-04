use {
    crate::api::{
        ChainId,
        Label,
        RestError,
    },
    anyhow::Result,
    axum::{
        extract::{
            Path,
            Query,
            State,
        },
        Json,
    },
    pythnet_sdk::wire::array,
    serde_with::serde_as,
    utoipa::{
        IntoParams,
        ToSchema,
    },
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
(status = 200, description = "Random value successfully retrieved", body = GetRandomValueResponse),
(status = 403, description = "Random value cannot currently be retrieved", body = String)
),
params(RevelationPathParams, RevelationQueryParams)
)]
pub async fn revelation(
    State(state): State<crate::api::ApiState>,
    Path(RevelationPathParams { chain_id, sequence }): Path<RevelationPathParams>,
    Query(RevelationQueryParams { encoding }): Query<RevelationQueryParams>,
) -> Result<Json<GetRandomValueResponse>, RestError> {
    state
        .metrics
        .request_counter
        .get_or_create(&Label {
            value: "/v1/chains/{chain_id}/revelations/{sequence}".to_string(),
        })
        .inc();

    let sequence: u64 = sequence
        .try_into()
        .map_err(|_| RestError::InvalidSequenceNumber)?;

    let state = state
        .chains
        .get(&chain_id)
        .ok_or_else(|| RestError::InvalidChainId)?;

    let maybe_request = state
        .contract
        .get_request(state.provider_address, sequence)
        .await
        .map_err(|_| RestError::TemporarilyUnavailable)?;

    match maybe_request {
        Some(_) => {
            let value = &state
                .state
                .reveal(sequence)
                .map_err(|_| RestError::Unknown)?;
            let encoded_value = Blob::new(encoding.unwrap_or(BinaryEncoding::Hex), value.clone());

            Ok(Json(GetRandomValueResponse {
                value: encoded_value,
            }))
        }
        None => Err(RestError::NoPendingRequest),
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Path)]
pub struct RevelationPathParams {
    #[param(value_type = String)]
    pub chain_id: ChainId,
    pub sequence: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct RevelationQueryParams {
    pub encoding: Option<BinaryEncoding>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum BinaryEncoding {
    #[serde(rename = "hex")]
    Hex,
    #[serde(rename = "base64")]
    Base64,
    #[serde(rename = "array")]
    Array,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct GetRandomValueResponse {
    pub value: Blob,
}

#[serde_as]
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
#[serde(tag = "encoding", rename_all = "kebab-case")]
pub enum Blob {
    Hex {
        #[serde_as(as = "serde_with::hex::Hex")]
        data: [u8; 32],
    },
    Base64 {
        #[serde_as(as = "serde_with::base64::Base64")]
        data: [u8; 32],
    },
    Array {
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

#[cfg(test)]
mod test {
    use {
        crate::{
            api::{
                mock::test_server,
                BinaryEncoding,
                Blob,
                GetRandomValueResponse,
            },
            state::PebbleHashChain,
        },
        axum::http::StatusCode,
        ethabi::ethereum_types::Address,
    };

    #[tokio::test]
    async fn test_get() {
        let hash_chain = PebbleHashChain::new([0u8; 32], 1000);
        let server = test_server(Address::random(), hash_chain.clone());

        let response = server.get("/v1/chains/ethereum/revelations/0").await;
        response.assert_status(StatusCode::OK);
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, hash_chain.reveal_ith(0).unwrap()),
        });

        let response = server.get("/v1/chains/not_a_chain/revelations/0").await;
        response.assert_status(StatusCode::BAD_REQUEST);

        let response = server.get("/v1/chains/ethereum/revelations/1").await;
        response.assert_status(StatusCode::FORBIDDEN);

        // TODO:
        // - test with multiple chain ids & different states
        // - test with hash chain offset
    }
}
