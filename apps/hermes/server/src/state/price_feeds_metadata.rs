use {
    crate::{
        api::types::{AssetType, PriceFeedMetadata},
        state::State,
    },
    anyhow::Result,
    tokio::sync::RwLock,
};

pub const DEFAULT_PRICE_FEEDS_CACHE_UPDATE_INTERVAL: u64 = 600;

#[derive(Default)]
pub struct PriceFeedMetaState {
    pub data: RwLock<Vec<PriceFeedMetadata>>,
}

impl PriceFeedMetaState {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(Vec::new()),
        }
    }
}

/// Allow downcasting State into CacheState for functions that depend on the `Cache` service.
impl<'a> From<&'a State> for &'a PriceFeedMetaState {
    fn from(state: &'a State) -> &'a PriceFeedMetaState {
        &state.price_feed_meta
    }
}

#[async_trait::async_trait]
pub trait PriceFeedMeta {
    async fn retrieve_price_feeds_metadata(&self) -> Result<Vec<PriceFeedMetadata>>;
    async fn store_price_feeds_metadata(
        &self,
        price_feeds_metadata: &[PriceFeedMetadata],
    ) -> Result<()>;
    async fn get_price_feeds_metadata(
        &self,
        query: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedMetadata>>;
}

#[async_trait::async_trait]
impl<T> PriceFeedMeta for T
where
    for<'a> &'a T: Into<&'a PriceFeedMetaState>,
    T: Sync,
{
    async fn retrieve_price_feeds_metadata(&self) -> Result<Vec<PriceFeedMetadata>> {
        let price_feeds_metadata = self.into().data.read().await;
        Ok(price_feeds_metadata.clone())
    }

    async fn store_price_feeds_metadata(
        &self,
        price_feeds_metadata: &[PriceFeedMetadata],
    ) -> Result<()> {
        let mut price_feeds_metadata_write_guard = self.into().data.write().await;
        *price_feeds_metadata_write_guard = price_feeds_metadata.to_vec();
        Ok(())
    }

    async fn get_price_feeds_metadata(
        &self,
        query: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedMetadata>> {
        let mut price_feeds_metadata = self.retrieve_price_feeds_metadata().await?;

        // Filter by query if provided
        if let Some(query_str) = &query {
            price_feeds_metadata.retain(|feed| {
                feed.attributes.get("symbol").map_or(false, |symbol| {
                    symbol.to_lowercase().contains(&query_str.to_lowercase())
                })
            });
        }

        // Filter by asset_type if provided
        if let Some(asset_type) = &asset_type {
            price_feeds_metadata.retain(|feed| {
                feed.attributes.get("asset_type").map_or(false, |type_str| {
                    type_str.to_lowercase().trim().replace(" ", "_")
                        == asset_type.to_string().to_lowercase()
                })
            });
        }

        Ok(price_feeds_metadata)
    }
}
