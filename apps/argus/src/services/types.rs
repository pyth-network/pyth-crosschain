use std::sync::Arc;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;

use crate::state::traits::{
    ReadSubscriptionState, WriteSubscriptionState,
    ReadPythPriceState, WritePythPriceState,
    ReadChainPriceState, WriteChainPriceState,
    SystemControl
};

#[async_trait]
pub trait Service: Send + Sync {
    fn name(&self) -> &str;
    
    async fn start(&self, stop_rx: watch::Receiver<bool>) -> Result<()>;
}

#[async_trait]
pub trait SubscriptionAware: Service {
    async fn start_with_subscription(
        &self,
        subscription_reader: Arc<dyn ReadSubscriptionState>,
        subscription_writer: Arc<dyn WriteSubscriptionState>,
        pyth_price_writer: Arc<dyn WritePythPriceState>,
        chain_price_writer: Arc<dyn WriteChainPriceState>,
        stop_rx: watch::Receiver<bool>
    ) -> Result<()>;
}

#[async_trait]
pub trait PythPriceAware: Service {
    async fn start_with_pyth_price(
        &self,
        pyth_price_reader: Arc<dyn ReadPythPriceState>,
        pyth_price_writer: Arc<dyn WritePythPriceState>,
        stop_rx: watch::Receiver<bool>
    ) -> Result<()>;
}

#[async_trait]
pub trait ChainPriceAware: Service {
    async fn start_with_chain_price(
        &self,
        chain_price_reader: Arc<dyn ReadChainPriceState>,
        chain_price_writer: Arc<dyn WriteChainPriceState>,
        stop_rx: watch::Receiver<bool>
    ) -> Result<()>;
}

#[async_trait]
pub trait SystemControlAware: Service {
    async fn start_with_system_control(
        &self,
        system_control: Arc<dyn SystemControl>,
        stop_rx: watch::Receiver<bool>
    ) -> Result<()>;
}

#[derive(Debug, Clone)]
pub struct PushRequest {
    pub subscription_id: crate::adapters::types::SubscriptionId,
    pub price_ids: Vec<crate::adapters::types::PriceId>,
}
