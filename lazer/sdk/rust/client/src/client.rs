use crate::{
    resilient_ws_connection::PythLazerResilientWSConnection, ws_connection::AnyResponse,
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Result};
use backoff::ExponentialBackoff;
use futures_util::stream;
use pyth_lazer_protocol::subscription::{SubscribeRequest, SubscriptionId};
use tokio::sync::mpsc::{self, error::TrySendError};
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use tracing::{error, warn};

pub struct PythLazerClient {
    endpoints: Vec<String>,
    access_token: String,
    num_connections: usize,
    ws_connections: Vec<PythLazerResilientWSConnection>,
    receivers: Vec<mpsc::Receiver<AnyResponse>>,
    backoff: ExponentialBackoff,
}

impl PythLazerClient {
    /// Creates a new client instance
    ///
    /// # Arguments
    /// * `endpoints` - A vector of endpoint URLs
    /// * `access_token` - The access token for authentication
    /// * `num_connections` - The number of WebSocket connections to maintain
    pub fn new(
        endpoints: Vec<String>,
        access_token: String,
        num_connections: usize,
        backoff: ExponentialBackoff,
    ) -> Result<Self> {
        if backoff.max_elapsed_time.is_some() {
            bail!("max_elapsed_time is not supported in Pyth Lazer client");
        }
        Ok(Self {
            endpoints,
            access_token,
            num_connections,
            ws_connections: Vec::with_capacity(num_connections),
            receivers: Vec::with_capacity(num_connections),
            backoff,
        })
    }

    pub async fn start(&mut self) -> Result<mpsc::Receiver<AnyResponse>> {
        let (sender, receiver) = mpsc::channel::<AnyResponse>(CHANNEL_CAPACITY);

        for i in 0..self.num_connections {
            let endpoint = self.endpoints[i % self.endpoints.len()].clone();
            let (sender, receiver) = mpsc::channel::<AnyResponse>(CHANNEL_CAPACITY);
            let connection = PythLazerResilientWSConnection::new(
                endpoint,
                self.access_token.clone(),
                self.backoff.clone(),
                sender.clone(),
            );
            self.ws_connections.push(connection);
            self.receivers.push(receiver);
        }

        let streams: Vec<_> = self.receivers.drain(..).map(ReceiverStream::new).collect();
        let mut merged_stream = stream::select_all(streams);

        tokio::spawn(async move {
            while let Some(response) = merged_stream.next().await {
                match sender.try_send(response) {
                    Ok(_) => (),
                    Err(TrySendError::Full(r)) => {
                        warn!("Sender channel is full, responses will be delayed");
                        if sender.send(r).await.is_err() {
                            error!("Sender channel is closed, stopping client");
                        }
                    }
                    Err(TrySendError::Closed(_)) => {
                        error!("Sender channel is closed, stopping client");
                    }
                }
            }
        });

        Ok(receiver)
    }

    pub async fn subscribe(&mut self, subscribe_request: SubscribeRequest) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection.subscribe(subscribe_request.clone()).await?;
        }
        Ok(())
    }

    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection.unsubscribe(subscription_id).await?;
        }
        Ok(())
    }
}
