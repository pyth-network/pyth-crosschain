//! Price Feeds
use {
    crate::{
        api::types::PriceFeedV2,
        config::RunOptions,
        state::State as AppState,
    },
    anyhow::Result,
    pyth_sdk::PriceIdentifier,
    pyth_sdk_solana::state::{
        load_mapping_account,
        load_product_account,
    },
    solana_client::rpc_client::RpcClient,
    solana_sdk::{
        bs58,
        pubkey::Pubkey,
    },
    std::{
        collections::BTreeMap,
        sync::Arc,
    },
};


#[tracing::instrument(skip(opts, state))]
pub async fn run(opts: RunOptions, state: Arc<AppState>) -> Result<()> {
    let update_interval = opts.price_feeds_cache_update_interval;
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(update_interval));

    loop {
        interval.tick().await;
        if let Err(e) = fetch_and_store_price_feeds(state.as_ref()).await {
            tracing::error!("Error in fetching and storing price feeds: {}", e);
        }
    }
}

pub async fn fetch_and_store_price_feeds(state: &AppState) -> Result<Vec<PriceFeedV2>> {
    let price_feeds = get_price_feeds_v2(&state).await?;
    state.cache.store_price_feeds(&price_feeds).await?;
    Ok(price_feeds)
}

async fn get_price_feeds_v2(state: &AppState) -> Result<Vec<PriceFeedV2>> {
    let mut price_feeds = Vec::<PriceFeedV2>::new();
    let client = RpcClient::new(&state.rpc_http_endpoint);
    let mapping_address = state
        .mapping_address
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Mapping address is not set"))?;
    let mapping_data = client.get_account_data(mapping_address)?;
    let map_acct = load_mapping_account(&mapping_data)?;
    for prod_pkey in &map_acct.products {
        let prod_data = client.get_account_data(prod_pkey)?;

        if *prod_pkey == Pubkey::default() {
            continue;
        }
        let prod_acct = load_product_account(&prod_data)?;

        let attributes = prod_acct
            .iter()
            .filter(|(key, _)| !key.is_empty())
            // Convert (&str, &str) to (String, String)
            .map(|(key, val)| (key.to_string(), val.to_string()))
            .collect::<BTreeMap<String, String>>();

        if prod_acct.px_acc != Pubkey::default() {
            let px_pkey = prod_acct.px_acc;

            // Convert px_pkey from base58 to hex
            let px_pkey_bytes = bs58::decode(&px_pkey.to_string()).into_vec()?;
            let px_pkey_array: [u8; 32] = px_pkey_bytes
                .try_into()
                .expect("Invalid length for PriceIdentifier");

            // Create PriceFeedV2
            let price_feed_v2 = PriceFeedV2 {
                id: PriceIdentifier::new(px_pkey_array),
                attributes,
            };

            price_feeds.push(price_feed_v2);
        }
    }
    Ok(price_feeds)
}
