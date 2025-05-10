use {
    crate::{
        adapters::types::{PriceId, SubscriptionId},
        shared::state::{ArgusSharedState, PushRequest},
    },
    anyhow::Result,
    std::{sync::Arc, time::Duration},
    tokio::{sync::watch, time},
    tracing,
};

pub struct TaskController {
    chain_id: String,
    shared_state: Arc<ArgusSharedState>,
    update_interval: Duration,
    stop_sender: watch::Sender<bool>,
    stop_receiver: watch::Receiver<bool>,
}

impl TaskController {
    pub fn new(chain_id: String, shared_state: Arc<ArgusSharedState>, update_interval: Duration) -> Self {
        let (stop_sender, stop_receiver) = watch::channel(false);
        Self {
            chain_id,
            shared_state,
            update_interval,
            stop_sender,
            stop_receiver,
        }
    }

    pub fn stop_token(&self) -> watch::Receiver<bool> {
        self.stop_receiver.clone()
    }

    pub fn shutdown(&self) {
        let _ = self.stop_sender.send(true);
    }

    pub async fn start_update_loop(&self) -> Result<()> {
        let mut interval = time::interval(self.update_interval);
        let mut stop_receiver = self.stop_receiver.clone();

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.perform_update().await {
                        tracing::error!(
                            chain_id = self.chain_id,
                            error = %e,
                            "Error performing update"
                        );
                    }
                }
                _ = stop_receiver.changed() => {
                    if *stop_receiver.borrow() {
                        tracing::info!(chain_id = self.chain_id, "Stopping controller update loop");
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    async fn perform_update(&self) -> Result<()> {
        tracing::info!(chain_id = self.chain_id, "Performing update (todo)");
        Ok(())
    }
}

pub struct SubscriptionListenerTask {
    chain_id: String,
    shared_state: Arc<ArgusSharedState>,
    poll_interval: Duration,
}

impl SubscriptionListenerTask {
    pub fn new(
        chain_id: String,
        shared_state: Arc<ArgusSharedState>,
        poll_interval: Duration,
    ) -> Self {
        Self {
            chain_id,
            shared_state,
            poll_interval,
        }
    }

    pub async fn run(&self, mut stop: watch::Receiver<bool>) -> Result<()> {
        let mut interval = time::interval(self.poll_interval);

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.refresh_subscriptions().await {
                        tracing::error!(
                            chain_id = self.chain_id,
                            error = %e,
                            "Failed to refresh subscriptions"
                        );
                    }
                }
                _ = stop.changed() => {
                    if *stop.borrow() {
                        tracing::info!(chain_id = self.chain_id, "Stopping subscription listener");
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    async fn refresh_subscriptions(&self) -> Result<()> {
        tracing::info!(chain_id = self.chain_id, "Refreshing subscriptions");
        Ok(())
    }
}

pub struct PythPriceListenerTask {
    chain_id: String,
    shared_state: Arc<ArgusSharedState>,
}

impl PythPriceListenerTask {
    pub fn new(
        chain_id: String,
        shared_state: Arc<ArgusSharedState>,
    ) -> Self {
        Self {
            chain_id,
            shared_state,
        }
    }

    pub async fn run(&self, mut stop: watch::Receiver<bool>) -> Result<()> {
        loop {
            if stop.changed().await.is_ok() && *stop.borrow() {
                tracing::info!(chain_id = self.chain_id, "Stopping Pyth price listener");
                break;
            }
        }

        Ok(())
    }

}

pub struct ChainPriceListenerTask {
    chain_id: String,
    shared_state: Arc<ArgusSharedState>,
    poll_interval: Duration,
}

impl ChainPriceListenerTask {
    pub fn new(
        chain_id: String,
        shared_state: Arc<ArgusSharedState>,
        poll_interval: Duration,
    ) -> Self {
        Self {
            chain_id,
            shared_state,
            poll_interval,
        }
    }

    pub async fn run(&self, mut stop: watch::Receiver<bool>) -> Result<()> {
        let mut interval = time::interval(self.poll_interval);

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    tracing::debug!(
                        chain_id = self.chain_id,
                        "Polling for on-chain price updates"
                    );
                }
                _ = stop.changed() => {
                    if *stop.borrow() {
                        tracing::info!(chain_id = self.chain_id, "Stopping chain price listener");
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}

pub struct PricePusherTask {
    chain_id: String,
    shared_state: Arc<ArgusSharedState>,
}

impl PricePusherTask {
    pub fn new(
        chain_id: String,
        shared_state: Arc<ArgusSharedState>,
    ) -> Self {
        Self {
            chain_id,
            shared_state,
        }
    }

    pub async fn run(&self, mut stop: watch::Receiver<bool>) -> Result<()> {
        loop {
            self.process_queue().await?;

            if stop.has_changed()? && *stop.borrow() {
                tracing::info!(chain_id = self.chain_id, "Stopping price pusher");
                break;
            }

            time::sleep(Duration::from_millis(100)).await;
        }

        Ok(())
    }

    async fn process_queue(&self) -> Result<()> {
        let mut requests = self.shared_state.push_queue.requests.lock().await;
        if requests.is_empty() {
            return Ok(());
        }

        let request = requests.remove(0);
        tracing::info!(
            chain_id = self.chain_id,
            subscription_id = request.subscription_id.to_string(),
            "Processing push request"
        );


        Ok(())
    }

    pub async fn queue_push_request(&self, request: PushRequest) -> Result<()> {
        let mut requests = self.shared_state.push_queue.requests.lock().await;
        requests.push(request);
        Ok(())
    }
}
