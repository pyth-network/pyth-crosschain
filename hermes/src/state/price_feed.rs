use {
    crate::api::types::{
        AssetType,
        PriceFeedV2,
    },
    anyhow::Result,
};


#[async_trait::async_trait]
pub trait PriceFeedProvider {
    async fn get_price_feeds_v2(
        &self,
        query: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedV2>>;
}

#[async_trait::async_trait]
impl PriceFeedProvider for crate::state::State {
    async fn get_price_feeds_v2(
        &self,
        query: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedV2>> {
        let mut price_feeds = {
            let feeds = self.cache.retrieve_price_feeds().await?;
            if feeds.is_empty() {
                // If the result is an empty Vec, fetch and store new price feeds
                crate::price_feeds::fetch_and_store_price_feeds(&self).await?
            } else {
                feeds
            }
        };


        // Filter by query if provided
        if let Some(query_str) = &query {
            price_feeds.retain(|feed| {
                feed.attributes.get("symbol").map_or(false, |symbol| {
                    symbol.to_lowercase().contains(&query_str.to_lowercase())
                })
            });
        }

        // Filter by asset_type if provided
        if let Some(asset_type) = &asset_type {
            price_feeds.retain(|feed| {
                feed.attributes.get("asset_type").map_or(false, |type_str| {
                    type_str.to_lowercase()
                        == serde_json::to_string(&asset_type)
                            .unwrap()
                            .trim_matches('"')
                            .to_string()
                })
            });
        }

        Ok(price_feeds)
    }
}
