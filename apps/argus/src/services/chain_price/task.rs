use {
    crate::shared::chain_price::state::ChainPriceState,
    anyhow::Result,
    std::{sync::Arc, time::Duration},
    tokio::{sync::watch, time},
    tracing,
};

pub struct ChainPriceListenerTask {
    chain_id: String,
    chain_price_state: Arc<ChainPriceState>,
    poll_interval: Duration,
}

impl ChainPriceListenerTask {
    pub fn new(
        chain_id: String,
        chain_price_state: Arc<ChainPriceState>,
        poll_interval: Duration,
    ) -> Self {
        Self {
            chain_id,
            chain_price_state,
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
