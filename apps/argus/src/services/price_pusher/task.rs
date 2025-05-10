use {
    crate::services::price_pusher::state::{PushQueue, PushRequest},
    anyhow::Result,
    std::{sync::Arc, time::Duration},
    tokio::{sync::watch, time},
    tracing,
};

pub struct PricePusherTask {
    chain_id: String,
    push_queue: Arc<PushQueue>,
}

impl PricePusherTask {
    pub fn new(chain_id: String, push_queue: Arc<PushQueue>) -> Self {
        Self {
            chain_id,
            push_queue,
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
        tracing::info!(chain_id = self.chain_id, "Processing push queue");

        Ok(())
    }

    pub async fn queue_push_request(&self, request: PushRequest) -> Result<()> {
        tracing::info!(
            chain_id = self.chain_id,
            subscription_id = request.subscription_id.to_string(),
            "Queuing push request"
        );

        Ok(())
    }
}
