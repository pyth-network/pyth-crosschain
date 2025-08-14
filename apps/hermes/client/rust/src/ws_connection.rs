use std::hash::{DefaultHasher, Hash, Hasher};

use anyhow::anyhow;
use anyhow::Result;
use derive_more::From;
use futures_util::{SinkExt, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::warn;
use url::Url;

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum HermesClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe(HermesClientMessageSubscribe),
    #[serde(rename = "unsubscribe")]
    Unsubscribe(HermesClientMessageUnsubscribe),
}

#[derive(Serialize, Debug, Clone)]
pub struct HermesClientMessageSubscribe {
    pub ids: Vec<String>,
    #[serde(default)]
    pub verbose: bool,
    #[serde(default)]
    pub binary: bool,
    #[serde(default)]
    pub allow_out_of_order: bool,
    #[serde(default)]
    pub ignore_invalid_price_ids: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct HermesClientMessageUnsubscribe {
    pub ids: Vec<String>,
}

#[derive(Deserialize, Debug, Clone, Hash)]
#[serde(tag = "type")]
pub enum HermesServerMessage {
    #[serde(rename = "response")]
    Response(HermesServerResponseMessage),
    #[serde(rename = "price_update")]
    PriceUpdate { price_feed: HermesPriceFeed },
}

impl HermesServerMessage {
    pub fn cache_key(&self) -> u64 {
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        hasher.finish()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Hash)]
#[serde(tag = "status")]
pub enum HermesServerResponseMessage {
    #[serde(rename = "success")]
    Success,
    #[serde(rename = "error")]
    Err { error: String },
}

#[derive(Deserialize, Serialize, Debug, Clone, Hash)]
pub struct HermesPriceFeed {
    pub id: String,
    pub price: HermesPrice,
    pub ema_price: HermesPrice,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HermesPriceFeedMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vaa: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone, Hash)]
pub struct HermesPrice {
    #[serde(with = "pyth_sdk::utils::as_string")]
    pub price: i64,
    #[serde(with = "pyth_sdk::utils::as_string")]
    pub conf: u64,
    /// Exponent.
    pub expo: i32,
    /// Publish time.
    pub publish_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash)]
pub struct HermesPriceFeedMetadata {
    pub slot: Option<u64>,
    pub emitter_chain: u16,
    pub price_service_receive_time: Option<i64>,
    pub prev_publish_time: Option<i64>,
}

/// A WebSocket client for consuming Pyth Hermes price feed updates
///
/// This client provides a simple interface to:
/// - Connect to a Hermes WebSocket endpoint
/// - Subscribe to price feed updates
/// - Receive updates as a stream of messages
///
pub struct HermesWSConnection {
    endpoint: Url,
    ws_sender: Option<
        futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
            Message,
        >,
    >,
}

impl HermesWSConnection {
    /// Creates a new Hermes client instance
    ///
    /// # Arguments
    /// * `endpoint` - The WebSocket URL of the Hermes service
    ///
    /// # Returns
    /// Returns a new client instance (not yet connected)
    pub fn new(endpoint: Url) -> Result<Self> {
        Ok(Self {
            endpoint,
            ws_sender: None,
        })
    }

    /// Starts the WebSocket connection
    ///
    /// # Returns
    /// Returns a stream of responses from the server
    pub async fn start(
        &mut self,
    ) -> Result<impl futures_util::Stream<Item = Result<HermesServerMessage>>> {
        let url = self.endpoint.clone();

        let (ws_stream, _) = connect_async(url).await?;
        let (ws_sender, ws_receiver) = ws_stream.split();

        self.ws_sender = Some(ws_sender);
        let response_stream =
            ws_receiver
                .map_err(anyhow::Error::from)
                .try_filter_map(|msg| async {
                    let r: Result<Option<HermesServerMessage>> = match msg {
                        Message::Text(text) => {
                            Ok(Some(serde_json::from_str::<HermesServerMessage>(&text)?))
                        }
                        Message::Binary(_) => {
                            warn!("Received unexpected binary message");
                            Ok(None)
                        }
                        Message::Close(_) => {
                            Err(anyhow!("WebSocket connection closed unexpectedly"))
                        }
                        _ => Ok(None),
                    };
                    r
                });

        Ok(response_stream)
    }

    pub async fn send_request(&mut self, request: HermesClientMessage) -> Result<()> {
        if let Some(sender) = &mut self.ws_sender {
            let msg = serde_json::to_string(&request)?;
            sender.send(Message::Text(msg)).await?;
            Ok(())
        } else {
            anyhow::bail!("WebSocket connection not started")
        }
    }

    /// Closes the WebSocket connection
    pub async fn close(&mut self) -> Result<()> {
        if let Some(sender) = &mut self.ws_sender {
            sender.send(Message::Close(None)).await?;
            self.ws_sender = None;
            Ok(())
        } else {
            anyhow::bail!("WebSocket connection not started")
        }
    }
}
