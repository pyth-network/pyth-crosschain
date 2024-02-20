use {
    crate::{
        api::types::{
            AssetType,
            PriceFeedMetadata,
        },
        state::State,
    },
    anyhow::Result,
};

pub async fn retrieve_price_feeds_metadata(state: &State) -> Result<Vec<PriceFeedMetadata>> {
    let price_feeds_metadata = state.price_feeds_metadata.read().await;
    Ok(price_feeds_metadata.clone())
}

pub async fn store_price_feeds_metadata(
    state: &State,
    price_feeds_metadata: &[PriceFeedMetadata],
) -> Result<()> {
    let mut price_feeds_metadata_write_guard = state.price_feeds_metadata.write().await;
    *price_feeds_metadata_write_guard = price_feeds_metadata.to_vec();
    Ok(())
}


pub async fn get_price_feeds_metadata(
    state: &State,
    query: Option<String>,
    asset_type: Option<AssetType>,
) -> Result<Vec<PriceFeedMetadata>> {
    let mut price_feeds_metadata = retrieve_price_feeds_metadata(state).await?;

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
