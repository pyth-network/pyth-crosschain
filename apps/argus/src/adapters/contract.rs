use super::ethereum::pyth_pulse;
use super::{ethereum::PythPulse, types::*};
use anyhow::Result;
use async_trait::async_trait;
use ethers::providers::Middleware;
use ethers::types::H256;
use std::collections::HashMap;

#[async_trait]
pub trait GetChainPrices {
    async fn get_price_unsafe(
        &self,
        subscription_id: SubscriptionId,
        feed_id: &PriceId,
    ) -> Result<Option<Price>>;

    async fn subscribe_to_price_events(&self) -> Result<()>;
}

#[async_trait]
impl<M: Middleware + 'static> GetChainPrices for PythPulse<M> {
    async fn get_price_unsafe(
        &self,
        _subscription_id: SubscriptionId,
        _feed_id: &PriceId,
    ) -> Result<Option<Price>> {
        todo!()
    }

    async fn subscribe_to_price_events(&self) -> Result<()> {
        tracing::debug!("Subscribing to price events via PythPulse");
        Ok(())
    }
}

#[async_trait]
impl<M: Middleware + 'static> UpdateChainPrices for PythPulse<M> {
    async fn update_price_feeds(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &[PriceId],
        update_data: &[Vec<u8>],
    ) -> Result<H256> {
        tracing::debug!(
            subscription_id = subscription_id.to_string(),
            price_ids_count = price_ids.len(),
            update_data_count = update_data.len(),
            "Updating price feeds on-chain via PythPulse"
        );
        todo!()
    }
}

#[async_trait]
impl<M: Middleware + 'static> ReadChainSubscriptions for PythPulse<M> {
    async fn get_active_subscriptions(
        &self,
    ) -> Result<HashMap<SubscriptionId, pyth_pulse::SubscriptionParams>> {
        // TODO: handle pagination
        let (ids, sub_params, _total_count) =
            self.get_active_subscriptions(0.into(), 1000.into()).await?;
        Ok(ids.into_iter().zip(sub_params).collect())
    }

    async fn subscribe_to_subscription_events(&self) -> Result<()> {
        Ok(())
    }
}
