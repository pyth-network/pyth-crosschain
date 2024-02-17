use {
    crate::{
        api::types::{
            AssetType,
            PriceFeedMetadata,
        },
        state::{
            retrieve_price_feeds_metadata,
            State,
        },
    },
    anyhow::Result,
};


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

    println!("price_feeds_metadata: {:?}", price_feeds_metadata.len());
    Ok(price_feeds_metadata)
}
