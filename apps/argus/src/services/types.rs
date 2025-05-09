use std::sync::Arc;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;

use crate::state::ArgusState;

#[async_trait]
pub trait Service: Send + Sync {
    fn name(&self) -> &str;
    
    async fn start(&self, state: Arc<ArgusState>, stop_rx: watch::Receiver<bool>) -> Result<()>;
}

#[derive(Debug, Clone)]
pub struct PushRequest {
    pub subscription_id: crate::adapters::types::SubscriptionId,
    pub price_ids: Vec<crate::adapters::types::PriceId>,
}
