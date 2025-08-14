use std::time::Duration;

use backoff::{backoff::Backoff, ExponentialBackoff};
use futures_util::StreamExt;

use tokio::{pin, select, sync::mpsc, time::Instant};
use tracing::{error, info};
use url::Url;

use crate::{
    ws_connection::{
        HermesClientMessage, HermesClientMessageSubscribe, HermesServerMessage, HermesWSConnection,
    },
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Context, Result};

const BACKOFF_RESET_DURATION: Duration = Duration::from_secs(10);

pub struct HermesResilientWSConnection {
    request_sender: mpsc::Sender<HermesClientMessage>,
}

impl HermesResilientWSConnection {
    /// Creates a new resilient WebSocket client instance
    ///
    /// # Arguments
    /// * `endpoint` - The WebSocket URL of the Lazer service
    /// * `sender` - A sender to send responses back to the client
    ///
    /// # Returns
    /// Returns a new client instance (not yet connected)
    pub fn new(
        endpoint: Url,
        backoff: ExponentialBackoff,
        timeout: Duration,
        sender: mpsc::Sender<HermesServerMessage>,
    ) -> Self {
        let (request_sender, mut request_receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = HermesWSConnectionTask::new(endpoint, backoff, timeout);

        tokio::spawn(async move {
            if let Err(e) = task.run(sender, &mut request_receiver).await {
                error!("Resilient WebSocket connection task failed: {}", e);
            }
        });

        Self { request_sender }
    }

    pub async fn send_request(&mut self, request: HermesClientMessage) -> Result<()> {
        self.request_sender
            .send(request)
            .await
            .context("Failed to send request")?;
        Ok(())
    }
}

struct HermesWSConnectionTask {
    endpoint: Url,
    subscribe_message: Option<HermesClientMessageSubscribe>,
    backoff: ExponentialBackoff,
    timeout: Duration,
}

impl HermesWSConnectionTask {
    pub fn new(endpoint: Url, backoff: ExponentialBackoff, timeout: Duration) -> Self {
        Self {
            endpoint,
            subscribe_message: None,
            backoff,
            timeout,
        }
    }

    pub async fn run(
        &mut self,
        response_sender: mpsc::Sender<HermesServerMessage>,
        request_receiver: &mut mpsc::Receiver<HermesClientMessage>,
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
        sender: mpsc::Sender<HermesServerMessage>,
        request_receiver: &mut mpsc::Receiver<HermesClientMessage>,
    ) -> Result<()> {
        let mut ws_connection = HermesWSConnection::new(self.endpoint.clone())?;
        let stream = ws_connection.start().await?;
        pin!(stream);

        if let Some(subscribe_message) = self.subscribe_message.clone() {
            ws_connection
                .send_request(HermesClientMessage::Subscribe(subscribe_message))
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
                   self.handle_request(&mut ws_connection,request).await?;
                }
            }
        }
    }

    pub async fn handle_request(
        &mut self,
        ws_connection: &mut HermesWSConnection,
        request: HermesClientMessage,
    ) -> Result<()> {
        match request.clone() {
            HermesClientMessage::Subscribe(subscribe_message) => {
                self.subscribe_message = Some(subscribe_message);
            }
            HermesClientMessage::Unsubscribe(unsubscribe_message) => {
                if let Some(mut subscribe_message) = self.subscribe_message.clone() {
                    subscribe_message
                        .ids
                        .retain(|id| !unsubscribe_message.ids.contains(id));
                    if subscribe_message.ids.is_empty() {
                        self.subscribe_message = None;
                    } else {
                        self.subscribe_message = Some(subscribe_message);
                    }
                }
            }
        }
        ws_connection.send_request(request).await
    }
}
