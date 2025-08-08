use std::hash::{DefaultHasher, Hash, Hasher};

use anyhow::Result;
use derive_more::From;
use futures_util::{SinkExt, StreamExt, TryStreamExt};
use pyth_lazer_protocol::{
    api::{ErrorResponse, SubscribeRequest, UnsubscribeRequest, WsRequest, WsResponse},
    binary_update::BinaryWsUpdate,
};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

/// A WebSocket client for consuming Pyth Lazer price feed updates
///
/// This client provides a simple interface to:
/// - Connect to a Lazer WebSocket endpoint
/// - Subscribe to price feed updates
/// - Receive updates as a stream of messages
///
pub struct PythLazerWSConnection {
    endpoint: Url,
    access_token: String,
    ws_sender: Option<
        futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
            Message,
        >,
    >,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, From)]
pub enum AnyResponse {
    Json(WsResponse),
    Binary(BinaryWsUpdate),
}

impl AnyResponse {
    pub fn cache_key(&self) -> u64 {
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        hasher.finish()
    }
}
impl PythLazerWSConnection {
    /// Creates a new Lazer client instance
    ///
    /// # Arguments
    /// * `endpoint` - The WebSocket URL of the Lazer service
    /// * `access_token` - Access token for authentication
    ///
    /// # Returns
    /// Returns a new client instance (not yet connected)
    pub fn new(endpoint: Url, access_token: String) -> Result<Self> {
        Ok(Self {
            endpoint,
            access_token,
            ws_sender: None,
        })
    }

    /// Starts the WebSocket connection
    ///
    /// # Returns
    /// Returns a stream of responses from the server
    pub async fn start(&mut self) -> Result<impl futures_util::Stream<Item = Result<AnyResponse>>> {
        let url = self.endpoint.clone();
        let mut request =
            tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(url)?;

        request.headers_mut().insert(
            "Authorization",
            format!("Bearer {}", self.access_token).parse().unwrap(),
        );

        let (ws_stream, _) = connect_async(request).await?;
        let (ws_sender, ws_receiver) = ws_stream.split();

        self.ws_sender = Some(ws_sender);
        let response_stream =
            ws_receiver
                .map_err(anyhow::Error::from)
                .try_filter_map(|msg| async {
                    let r: Result<Option<AnyResponse>> = match msg {
                        Message::Text(text) => {
                            Ok(Some(serde_json::from_str::<WsResponse>(&text)?.into()))
                        }
                        Message::Binary(data) => {
                            Ok(Some(BinaryWsUpdate::deserialize_slice(&data)?.into()))
                        }
                        Message::Close(_) => Ok(Some(
                            WsResponse::Error(ErrorResponse {
                                error: "WebSocket connection closed".to_string(),
                            })
                            .into(),
                        )),
                        _ => Ok(None),
                    };
                    r
                });

        Ok(response_stream)
    }

    pub async fn send_request(&mut self, request: WsRequest) -> Result<()> {
        if let Some(sender) = &mut self.ws_sender {
            let msg = serde_json::to_string(&request)?;
            sender.send(Message::Text(msg)).await?;
            Ok(())
        } else {
            anyhow::bail!("WebSocket connection not started")
        }
    }

    /// Subscribes to price feed updates
    ///
    /// # Arguments
    /// * `request` - A subscription request containing feed IDs and parameters
    pub async fn subscribe(&mut self, request: SubscribeRequest) -> Result<()> {
        let request = WsRequest::Subscribe(request);
        self.send_request(request).await
    }

    /// Unsubscribes from a previously subscribed feed
    ///
    /// # Arguments
    /// * `subscription_id` - The ID of the subscription to cancel
    pub async fn unsubscribe(&mut self, request: UnsubscribeRequest) -> Result<()> {
        let request = WsRequest::Unsubscribe(request);
        self.send_request(request).await
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
