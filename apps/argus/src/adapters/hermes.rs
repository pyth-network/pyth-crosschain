use super::types::*;
use anyhow::Result;

pub struct HermesClient;

impl ReadPythPrices for HermesClient {
    async fn get_latest_prices(&self, feed_ids: &[PriceId]) -> Result<Vec<Vec<u8>>> {
        todo!()
    }

    async fn subscribe_to_price_updates(&self, feed_ids: &[PriceId]) -> Result<()> {
        todo!()
    }
}
