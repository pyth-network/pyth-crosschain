use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use pyth_lazer_protocol::subscription::{
    ErrorResponse, Request, Response, SubscriptionId, UnsubscribeRequest,
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
pub struct LazerClient {
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

impl LazerClient {
    /// Creates a new Lazer client instance
    ///
    /// # Arguments
    /// * `endpoint` - The WebSocket URL of the Lazer service
    /// * `access_token` - Access token for authentication
    ///
    /// # Returns
    /// Returns a new client instance (not yet connected)
    pub fn new(endpoint: &str, access_token: &str) -> Result<Self> {
        let endpoint = Url::parse(endpoint)?;
        let access_token = access_token.to_string();
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
    pub async fn start(&mut self) -> Result<impl futures_util::Stream<Item = Result<Response>>> {
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
        let response_stream = ws_receiver.map(|msg| -> Result<Response> {
            let msg = msg?;
            match msg {
                Message::Text(text) => Ok(serde_json::from_str(&text)?),
                Message::Binary(data) => Ok(Response::from_binary(&data)?),
                Message::Close(_) => Ok(Response::Error(ErrorResponse {
                    error: "WebSocket connection closed".to_string(),
                })),
                _ => Ok(Response::Error(ErrorResponse {
                    error: "Unexpected message type".to_string(),
                })),
            }
        });

        Ok(response_stream)
    }

    /// Subscribes to price feed updates
    ///
    /// # Arguments
    /// * `request` - A subscription request containing feed IDs and parameters
    pub async fn subscribe(&mut self, request: Request) -> Result<()> {
        if let Some(sender) = &mut self.ws_sender {
            let msg = serde_json::to_string(&request)?;
            sender.send(Message::Text(msg)).await?;
            Ok(())
        } else {
            anyhow::bail!("WebSocket connection not started")
        }
    }

    /// Unsubscribes from a previously subscribed feed
    ///
    /// # Arguments
    /// * `subscription_id` - The ID of the subscription to cancel
    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        if let Some(sender) = &mut self.ws_sender {
            let request = Request::Unsubscribe(UnsubscribeRequest { subscription_id });
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
