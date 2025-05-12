use super::types::*;
use anyhow::Result;
use async_trait::async_trait;
pub struct HermesClient;

#[async_trait]
impl ReadPythPrices for HermesClient {
    async fn get_latest_prices(&self, _feed_ids: &[PriceId]) -> Result<Vec<Vec<u8>>> {
        todo!()
    }

    async fn subscribe_to_price_updates(&self, _feed_ids: &[PriceId]) -> Result<()> {
        todo!()
    }
}
