//! Types descibing general WebSocket subscription/unsubscription JSON messages
//! used across publishers, agents and routers.

use {
    crate::{
        payload::{
            BINARY_UPDATE_FORMAT_MAGIC, EVM_FORMAT_MAGIC, PARSED_FORMAT_MAGIC,
            SOLANA_FORMAT_MAGIC_BE,
        },
        router::{JsonBinaryData, JsonBinaryEncoding, JsonUpdate, SubscriptionParams},
    },
    anyhow::bail,
    base64::Engine,
    derive_more::From,
    serde::{Deserialize, Serialize},
};

/// A request sent from the client to the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum Request {
    Subscribe(SubscribeRequest),
    Unsubscribe(UnsubscribeRequest),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SubscriptionId(pub u64);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeRequest {
    pub subscription_id: SubscriptionId,
    #[serde(flatten)]
    pub params: SubscriptionParams,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribeRequest {
    pub subscription_id: SubscriptionId,
}

/// A JSON response sent from the server to the client.
#[derive(Debug, Clone, Serialize, Deserialize, From)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum Response {
    Error(ErrorResponse),
    Subscribed(SubscribedResponse),
    Unsubscribed(UnsubscribedResponse),
    SubscriptionError(SubscriptionErrorResponse),
    StreamUpdated(StreamUpdatedResponse),
}

impl Response {
    /// Parse a binary server message into a Response
    pub fn from_binary(data: &[u8]) -> anyhow::Result<Self> {
        let mut pos = 0;
        let magic = u32::from_be_bytes(data[pos..pos + 4].try_into()?);
        pos += 4;

        if magic != BINARY_UPDATE_FORMAT_MAGIC {
            bail!("binary update format magic mismatch");
        }

        let subscription_id = SubscriptionId(u64::from_be_bytes(data[pos..pos + 8].try_into()?));
        pos += 8;

        let mut evm = None;
        let mut solana = None;
        let mut parsed = None;

        while pos < data.len() {
            let len = u16::from_be_bytes(data[pos..pos + 2].try_into()?) as usize;
            pos += 2;
            let magic = u32::from_be_bytes(data[pos..pos + 4].try_into()?);

            match magic {
                EVM_FORMAT_MAGIC => {
                    evm = Some(JsonBinaryData {
                        encoding: JsonBinaryEncoding::Base64,
                        data: base64::engine::general_purpose::STANDARD
                            .encode(&data[pos..pos + len]),
                    });
                }
                SOLANA_FORMAT_MAGIC_BE => {
                    solana = Some(JsonBinaryData {
                        encoding: JsonBinaryEncoding::Base64,
                        data: base64::engine::general_purpose::STANDARD
                            .encode(&data[pos..pos + len]),
                    });
                }
                PARSED_FORMAT_MAGIC => {
                    parsed = Some(serde_json::from_slice(&data[pos + 4..pos + len])?);
                }
                _ => bail!("unknown magic: {}", magic),
            }
            pos += len;
        }

        Ok(Response::StreamUpdated(StreamUpdatedResponse {
            subscription_id,
            payload: JsonUpdate {
                evm,
                solana,
                parsed,
            },
        }))
    }
}

/// Sent from the server after a successul subscription.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedResponse {
    pub subscription_id: SubscriptionId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribedResponse {
    pub subscription_id: SubscriptionId,
}

/// Sent from the server if the requested subscription or unsubscription request
/// could not be fulfilled.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionErrorResponse {
    pub subscription_id: SubscriptionId,
    pub error: String,
}

/// Sent from the server if an internal error occured while serving data for an existing subscription,
/// or a client request sent a bad request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
}

/// Sent from the server when new data is available for an existing subscription
/// (only if `delivery_format == Json`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamUpdatedResponse {
    pub subscription_id: SubscriptionId,
    #[serde(flatten)]
    pub payload: JsonUpdate,
}
