use super::ethereum::PythPulse;
use super::types::*;
use crate::adapters::ethereum::SubscriptionParams;
use anyhow::Result;
use async_trait::async_trait;
use ethers::providers::Middleware;
use ethers::types::H256;
use pyth_sdk::Price;
use std::collections::HashMap;

#[async_trait]
pub trait GetChainPrices {
    async fn get_all_prices_for_subscription(
        &self,
        subscription_id: SubscriptionId,
    ) -> Result<Vec<Price>>;

    async fn get_prices_for_subscription(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &Vec<PriceId>,
    ) -> Result<Vec<Price>>;
}

#[async_trait]
impl<M: Middleware + 'static> GetChainPrices for PythPulse<M> {
    async fn get_all_prices_for_subscription(
        &self,
        subscription_id: SubscriptionId,
    ) -> Result<Vec<Price>> {
        let price_ids = self.get_prices_unsafe(subscription_id, vec![]).await?;
        Ok(price_ids.into_iter().map(From::from).collect())
    }
    async fn get_prices_for_subscription(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &Vec<PriceId>,
    ) -> Result<Vec<Price>> {
        let price_ids = self
            .get_prices_unsafe(
                subscription_id,
                price_ids.into_iter().map(|id| id.to_bytes()).collect(),
            )
            .await?;
        Ok(price_ids.into_iter().map(From::from).collect())
    }
}
#[async_trait]
pub trait UpdateChainPrices {
    async fn update_price_feeds(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &[PriceId],
        update_data: &[Vec<u8>],
    ) -> Result<H256>;
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
pub trait ReadChainSubscriptions {
    async fn get_active_subscriptions(&self)
        -> Result<HashMap<SubscriptionId, SubscriptionParams>>;
}

#[async_trait]
impl<M: Middleware + 'static> ReadChainSubscriptions for PythPulse<M> {
    async fn get_active_subscriptions(
        &self,
    ) -> Result<HashMap<SubscriptionId, SubscriptionParams>> {
        tracing::debug!("Getting active subscriptions via PythPulse");
        Ok(HashMap::new())
    }
}
