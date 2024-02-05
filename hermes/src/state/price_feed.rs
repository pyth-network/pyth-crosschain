use {
    crate::api::types::{
        AssetType,
        PriceFeedV2,
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
    std::collections::BTreeMap,
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
        let mut price_feeds = Vec::<PriceFeedV2>::new();
        let client = RpcClient::new(&self.rpc_http_endpoint);
        let mapping_address = self
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

            // Check if the attributes contain a symbol that matches the query (case insensitive)
            let symbol_matches_query = match &query {
                Some(q) => attributes.get("symbol").map_or(false, |symbol| {
                    symbol.to_lowercase().contains(&q.to_lowercase())
                }),
                None => true, // If no query is provided, do not filter out this price feed
            };

            // Check if the attributes contain an asset_type that matches the filter (case insensitive)
            let asset_type_matches = match &asset_type {
                Some(at) => attributes.get("asset_type").map_or(false, |a_type| {
                    a_type.to_lowercase()
                        == serde_json::to_string(&at)
                            .unwrap()
                            .trim_matches('"')
                            .to_string()
                }),
                None => true,
            };

            if !symbol_matches_query || !asset_type_matches {
                continue;
            }

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
}
