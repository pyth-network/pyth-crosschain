use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use pyth_lazer_protocol::{
    message::{EvmMessage, SolanaMessage},
    payload::{
        BINARY_UPDATE_FORMAT_MAGIC, EVM_FORMAT_MAGIC, PARSED_FORMAT_MAGIC, SOLANA_FORMAT_MAGIC_BE,
    },
    router::{JsonBinaryData, JsonBinaryEncoding, JsonUpdate},
    subscription::{
        ErrorResponse, Request, Response, StreamUpdatedResponse, SubscriptionId, UnsubscribeRequest,
    },
};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

/// Response type for binary messages containing chain-specific data
#[derive(Debug)]
pub enum BinaryResponse {
    /// EVM chain message with payload and signature
    Evm(EvmMessage),
    /// Solana chain message with payload and signature
    Solana(SolanaMessage),
    /// Parsed JSON payload for human-readable format
    Parsed(serde_json::Value),
}

/// A WebSocket client for consuming Pyth Lazer price feed updates
///
/// This client provides a simple interface to:
/// - Connect to a Lazer WebSocket endpoint
/// - Subscribe to price feed updates
/// - Receive updates as a stream of messages
///
/// # Example
/// ```no_run
/// use pyth_lazer_sdk::LazerClient;
/// use pyth_lazer_protocol::subscription::{Request, SubscribeRequest, SubscriptionParams};
///
/// #[tokio::main]
/// async fn main() -> anyhow::Result<()> {
///     let (mut client, mut stream) = LazerConsumerClient::start("wss://endpoint").await?;
///
///     // Subscribe to price feeds
///     client.subscribe(Request::Subscribe(SubscribeRequest {
///         subscription_id: SubscriptionId(1),
///         params: SubscriptionParams { /* ... */ },
///     })).await?;
///
///     // Process updates
///     while let Some(msg) = stream.next().await {
///         println!("Received: {:?}", msg?);
///     }
///     Ok(())
/// }
/// ```
pub struct LazerClient {
    ws_sender: futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
}

impl LazerClient {
    /// Starts a new WebSocket connection to the Lazer endpoint
    ///
    /// # Arguments
    /// * `url` - The WebSocket URL of the Lazer service
    ///
    /// # Returns
    /// Returns a tuple containing:
    /// - The client instance for sending requests
    /// - A stream of responses from the server
    pub async fn start(
        url: &str,
    ) -> Result<(Self, impl futures_util::Stream<Item = Result<Response>>)> {
        let url = Url::parse(url)?;
        let (ws_stream, _) = connect_async(url).await?;
        let (ws_sender, ws_receiver) = ws_stream.split();

        let client = Self { ws_sender };
        let response_stream = ws_receiver.map(|msg| -> Result<Response> {
            let msg = msg?;
            match msg {
                Message::Text(text) => Ok(serde_json::from_str(&text)?),
                Message::Binary(data) => {
                    let mut pos = 0;
                    let magic = u32::from_be_bytes(data[pos..pos + 4].try_into()?);
                    pos += 4;

                    if magic != BINARY_UPDATE_FORMAT_MAGIC {
                        anyhow::bail!("binary update format magic mismatch");
                    }

                    let subscription_id =
                        SubscriptionId(u64::from_be_bytes(data[pos..pos + 8].try_into()?));
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
                                evm =
                                    Some(EvmMessage::deserialize_slice(&data[pos..pos + len])?);
                            }
                            SOLANA_FORMAT_MAGIC_BE => {
                                solana =
                                    Some(SolanaMessage::deserialize_slice(&data[pos..pos + len])?);
                            }
                            PARSED_FORMAT_MAGIC => {
                                parsed = Some(serde_json::from_slice(&data[pos + 4..pos + len])?);
                            }
                            _ => anyhow::bail!("unknown magic: {}", magic),
                        }
                        pos += len;
                    }

                    Ok(Response::StreamUpdated(StreamUpdatedResponse {
                        subscription_id,
                        payload: JsonUpdate {
                            evm: evm.map(|m| JsonBinaryData {
                                encoding: JsonBinaryEncoding::Base64,
                                data: base64::engine::general_purpose::STANDARD.encode(&m.payload),
                            }),
                            solana: solana.map(|m| JsonBinaryData {
                                encoding: JsonBinaryEncoding::Base64,
                                data: base64::engine::general_purpose::STANDARD.encode(&m.payload),
                            }),
                            parsed,
                        },
                    }))
                }
                Message::Close(_) => Ok(Response::Error(ErrorResponse {
                    error: "WebSocket connection closed".to_string(),
                })),
                _ => Ok(Response::Error(ErrorResponse {
                    error: "Unexpected message type".to_string(),
                })),
            }
        });

        Ok((client, response_stream))
    }

    /// Subscribes to price feed updates
    ///
    /// # Arguments
    /// * `request` - A subscription request containing feed IDs and parameters
    pub async fn subscribe(&mut self, request: Request) -> Result<()> {
        let msg = serde_json::to_string(&request)?;
        self.ws_sender.send(Message::Text(msg)).await?;
        Ok(())
    }

    /// Unsubscribes from a previously subscribed feed
    ///
    /// # Arguments
    /// * `subscription_id` - The ID of the subscription to cancel
    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        let request = Request::Unsubscribe(UnsubscribeRequest { subscription_id });
        let msg = serde_json::to_string(&request)?;
        self.ws_sender.send(Message::Text(msg)).await?;
        Ok(())
    }
}
