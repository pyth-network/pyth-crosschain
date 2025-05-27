//! Service Types
//!
//! This module defines the core types and traits used across all services in the system.

use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;

#[async_trait]
pub trait Service: Send + Sync {
    fn name(&self) -> &str;

    async fn start(&self, stop_rx: watch::Receiver<bool>) -> Result<()>;
}

#[derive(Debug, Clone)]
pub struct PushRequest {
    pub subscription_id: crate::adapters::types::SubscriptionId,
    pub price_ids: Vec<crate::adapters::types::PriceId>,
}
