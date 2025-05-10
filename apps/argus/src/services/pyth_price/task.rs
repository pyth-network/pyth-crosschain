use {
    crate::services::pyth_price::state::PythPriceState,
    anyhow::Result,
    std::{sync::Arc, time::Duration},
    tokio::sync::watch,
    tracing,
};

pub struct PythPriceListenerTask {
    chain_id: String,
    pyth_price_state: Arc<PythPriceState>,
}

impl PythPriceListenerTask {
    pub fn new(chain_id: String, pyth_price_state: Arc<PythPriceState>) -> Self {
        Self {
            chain_id,
            pyth_price_state,
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
