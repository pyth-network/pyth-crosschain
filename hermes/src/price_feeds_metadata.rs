use {
    crate::{
        api::types::{
            AssetType,
            PriceFeedMetadata,
        },
        state::{
            cache::AggregateCache,
            retrieve_price_feeds_metadata,
        },
    },
    anyhow::Result,
};


pub async fn get_price_feeds_metadata<S>(
    state: &S,
    query: Option<String>,
    asset_type: Option<AssetType>,
) -> Result<Vec<PriceFeedMetadata>>
where
    S: AggregateCache,
    S: PriceFeedMetadataProvider,
{
    match PriceFeedMetadataProvider::get_price_feeds_metadata(state, query, asset_type).await {
        Ok(price_feeds_with_update_data) => Ok(price_feeds_with_update_data),
        Err(e) => Err(e),
    }
}


#[async_trait::async_trait]
pub trait PriceFeedMetadataProvider {
    async fn get_price_feeds_metadata(
        &self,
        query: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedMetadata>>;
}

#[async_trait::async_trait]
impl PriceFeedMetadataProvider for crate::state::State {
    async fn get_price_feeds_metadata(
        &self,
        query: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedMetadata>> {
        let mut price_feeds_metadata = retrieve_price_feeds_metadata(&self).await?;


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
                    type_str.to_lowercase() == asset_type.to_string().to_lowercase()
                })
            });
        }

        Ok(price_feeds_metadata)
    }
}
