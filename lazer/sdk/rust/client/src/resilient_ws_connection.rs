use std::time::Duration;

use backoff::{backoff::Backoff, ExponentialBackoff};
use futures_util::StreamExt;
use pyth_lazer_protocol::api::{SubscribeRequest, SubscriptionId, UnsubscribeRequest, WsRequest};
use tokio::{pin, select, sync::mpsc, time::Instant};
use tracing::{error, info, warn};
use url::Url;

use crate::{
    ws_connection::{AnyResponse, PythLazerWSConnection},
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Context, Result};

const BACKOFF_RESET_DURATION: Duration = Duration::from_secs(10);

pub struct PythLazerResilientWSConnection {
    request_sender: mpsc::Sender<WsRequest>,
}

impl PythLazerResilientWSConnection {
    /// Creates a new resilient WebSocket client instance
    ///
    /// # Arguments
    /// * `endpoint` - The WebSocket URL of the Lazer service
    /// * `access_token` - Access token for authentication
    /// * `sender` - A sender to send responses back to the client
    ///
    /// # Returns
    /// Returns a new client instance (not yet connected)
    pub fn new(
        endpoint: Url,
        access_token: String,
        backoff: ExponentialBackoff,
        timeout: Duration,
        sender: mpsc::Sender<AnyResponse>,
    ) -> Self {
        let (request_sender, mut request_receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task =
            PythLazerResilientWSConnectionTask::new(endpoint, access_token, backoff, timeout);

        tokio::spawn(async move {
            if let Err(e) = task.run(sender, &mut request_receiver).await {
                error!("Resilient WebSocket connection task failed: {}", e);
            }
        });

        Self { request_sender }
    }

    pub async fn subscribe(&mut self, request: SubscribeRequest) -> Result<()> {
        self.request_sender
            .send(WsRequest::Subscribe(request))
            .await
            .context("Failed to send subscribe request")?;
        Ok(())
    }

    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        self.request_sender
            .send(WsRequest::Unsubscribe(UnsubscribeRequest {
                subscription_id,
            }))
            .await
            .context("Failed to send unsubscribe request")?;
        Ok(())
    }
}

struct PythLazerResilientWSConnectionTask {
    endpoint: Url,
    access_token: String,
    subscriptions: Vec<SubscribeRequest>,
    backoff: ExponentialBackoff,
    timeout: Duration,
}

impl PythLazerResilientWSConnectionTask {
    pub fn new(
        endpoint: Url,
        access_token: String,
        backoff: ExponentialBackoff,
        timeout: Duration,
    ) -> Self {
        Self {
            endpoint,
            access_token,
            subscriptions: Vec::new(),
            backoff,
            timeout,
        }
    }

    pub async fn run(
        &mut self,
        response_sender: mpsc::Sender<AnyResponse>,
        request_receiver: &mut mpsc::Receiver<WsRequest>,
    ) -> Result<()> {
        loop {
            let start_time = Instant::now();
            if let Err(e) = self.start(response_sender.clone(), request_receiver).await {
                // If a connection was working for BACKOFF_RESET_DURATION
                // and timeout + 1sec, it was considered successful therefore reset the backoff
                if start_time.elapsed() > BACKOFF_RESET_DURATION
                    && start_time.elapsed() > self.timeout + Duration::from_secs(1)
                {
                    self.backoff.reset();
                }

                let delay = self.backoff.next_backoff();
                match delay {
                    Some(d) => {
                        info!("WebSocket connection failed: {}. Retrying in {:?}", e, d);
                        tokio::time::sleep(d).await;
                    }
                    None => {
                        bail!(
                            "Max retries reached for WebSocket connection to {}, this should never happen, please contact developers",
                            self.endpoint
                        );
                    }
                }
            }
        }
    }

    pub async fn start(
        &mut self,
        sender: mpsc::Sender<AnyResponse>,
        request_receiver: &mut mpsc::Receiver<WsRequest>,
    ) -> Result<()> {
        let mut ws_connection =
            PythLazerWSConnection::new(self.endpoint.clone(), self.access_token.clone())?;
        let stream = ws_connection.start().await?;
        pin!(stream);

        for subscription in self.subscriptions.clone() {
            ws_connection
                .send_request(WsRequest::Subscribe(subscription))
                .await?;
        }
        loop {
            let timeout_response = tokio::time::timeout(self.timeout, stream.next());

            select! {
                response = timeout_response => {
                    match response {
                        Ok(Some(response)) => match response {
                            Ok(response) => {
                                sender
                                    .send(response)
                                    .await
                                    .context("Failed to send response")?;
                            }
                            Err(e) => {
                                bail!("WebSocket stream error: {}", e);
                            }
                        },
                        Ok(None) => {
                            bail!("WebSocket stream ended unexpectedly");
                        }
                        Err(_elapsed) => {
                            bail!("WebSocket stream timed out");
                        }
                    }
                }
                Some(request) = request_receiver.recv() => {
                   match request {
                        WsRequest::Subscribe(request) => {
                            self.subscribe(&mut ws_connection, request).await?;
                        }
                        WsRequest::Unsubscribe(request) => {
                            self.unsubscribe(&mut ws_connection, request).await?;
                        }
                   }
                }
            }
        }
    }

    pub async fn subscribe(
        &mut self,
        ws_connection: &mut PythLazerWSConnection,
        request: SubscribeRequest,
    ) -> Result<()> {
        self.subscriptions.push(request.clone());
        ws_connection.subscribe(request).await
    }

    pub async fn unsubscribe(
        &mut self,
        ws_connection: &mut PythLazerWSConnection,
        request: UnsubscribeRequest,
    ) -> Result<()> {
        if let Some(index) = self
            .subscriptions
            .iter()
            .position(|r| r.subscription_id == request.subscription_id)
        {
            self.subscriptions.remove(index);
        } else {
            warn!(
                "Unsubscribe called for non-existent subscription: {:?}",
                request.subscription_id
            );
        }
        ws_connection.unsubscribe(request).await
    }
}
