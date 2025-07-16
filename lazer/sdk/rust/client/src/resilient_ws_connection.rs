use backoff::{backoff::Backoff, ExponentialBackoff};
use futures_util::StreamExt;
use pyth_lazer_protocol::subscription::{
    Request, SubscribeRequest, SubscriptionId, UnsubscribeRequest,
};
use tokio::{pin, select, sync::mpsc};
use tracing::{error, info, warn};

use crate::{
    ws_connection::{AnyResponse, PythLazerWSConnection},
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Context, Result};

pub struct PythLazerResilientWSConnection {
    request_sender: mpsc::Sender<Request>,
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
        endpoint: String,
        access_token: String,
        backoff: ExponentialBackoff,
        sender: mpsc::Sender<AnyResponse>,
    ) -> Self {
        let (request_sender, mut request_receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = PythLazerResilientWSConnectionTask::new(endpoint, access_token, backoff);

        tokio::spawn(async move {
            if let Err(e) = task.run(sender, &mut request_receiver).await {
                error!("Resilient WebSocket connection task failed: {}", e);
            }
        });

        Self { request_sender }
    }

    pub async fn subscribe(&mut self, request: SubscribeRequest) -> Result<()> {
        self.request_sender
            .send(Request::Subscribe(request))
            .await
            .context("Failed to send subscribe request")?;
        Ok(())
    }

    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        self.request_sender
            .send(Request::Unsubscribe(UnsubscribeRequest { subscription_id }))
            .await
            .context("Failed to send unsubscribe request")?;
        Ok(())
    }
}

struct PythLazerResilientWSConnectionTask {
    endpoint: String,
    access_token: String,
    subscriptions: Vec<SubscribeRequest>,
    backoff: ExponentialBackoff,
}

impl PythLazerResilientWSConnectionTask {
    pub fn new(endpoint: String, access_token: String, backoff: ExponentialBackoff) -> Self {
        Self {
            endpoint,
            access_token,
            subscriptions: Vec::new(),
            backoff,
        }
    }

    pub async fn run(
        &mut self,
        response_sender: mpsc::Sender<AnyResponse>,
        request_receiver: &mut mpsc::Receiver<Request>,
    ) -> Result<()> {
        loop {
            if let Err(e) = self.start(response_sender.clone(), request_receiver).await {
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
        request_receiver: &mut mpsc::Receiver<Request>,
    ) -> Result<()> {
        let mut ws_connection =
            PythLazerWSConnection::new(self.endpoint.clone(), self.access_token.clone())?;
        let stream = ws_connection.start().await?;
        pin!(stream);

        for subscription in self.subscriptions.clone() {
            ws_connection
                .send_request(Request::Subscribe(subscription))
                .await?;
        }
        loop {
            select! {
                response = stream.next() => {
                    match response {
                        Some(response) => match response {
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
                        None => {
                            bail!("WebSocket stream ended unexpectedly");
                        }
                    }
                }
                Some(request) = request_receiver.recv() => {
                   match request {
                        Request::Subscribe(request) => {
                            self.subscribe(&mut ws_connection, request).await?;
                        }
                        Request::Unsubscribe(request) => {
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
        return ws_connection.subscribe(request).await;
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
        return ws_connection.unsubscribe(request).await;
    }
}
