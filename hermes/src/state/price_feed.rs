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
    std::collections::HashMap,
};


#[async_trait::async_trait]
pub trait PriceFeedProvider {
    async fn get_price_feeds_v2(
        &self,
        filter: Option<String>,
        asset_type: Option<AssetType>,
    ) -> Result<Vec<PriceFeedV2>>;
}

#[async_trait::async_trait]
impl PriceFeedProvider for crate::state::State {
    async fn get_price_feeds_v2(
        &self,
        filter: Option<String>,
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
            let prod_acct = load_product_account(&prod_data)?;

            // print key and reference data for this Product
            println!("product_account .. {:?}", prod_pkey);
            for (key, val) in prod_acct.iter() {
                if !key.is_empty() {
                    println!("  {:.<16} {}", key, val);
                }
            }


            let attributes = prod_acct
                .iter()
                .filter(|(key, _)| !key.is_empty())
                // Convert (&str, &str) to (String, String)
                .map(|(key, val)| (key.to_string(), val.to_string()))
                .collect::<HashMap<String, String>>();

            if prod_acct.px_acc != Pubkey::default() {
                let px_pkey = prod_acct.px_acc;

                // Convert px_pkey from base58 to hex
                let px_pkey_bytes = bs58::decode(&px_pkey.to_string()).into_vec()?;


                // Create PriceFeedV2
                let price_feed_v2 = PriceFeedV2 {
                    id: PriceIdentifier::new(
                        hex::decode(&px_pkey_bytes)?
                            .try_into()
                            .expect("Invalid length for PriceIdentifier"),
                    ),
                    attributes,
                };

                price_feeds.push(price_feed_v2);
            }
        }
        let products = map_acct.products[..map_acct.num as usize].to_vec();
        let chunk_size = 100;
        let chunked_products = products.chunks(chunk_size);
        let mut product_mapping = HashMap::<Pubkey, String>::new();
        for chunk in chunked_products {
            let accounts = client.get_multiple_accounts(chunk)?;
            for (account_pubkey, account) in chunk.iter().zip(accounts) {
                match account {
                    None => {}
                    Some(acc) => {
                        let product_account = load_product_account(&acc.data);
                        match product_account {
                            Ok(product_account) => {
                                for (key, val) in product_account.iter() {
                                    if key == "symbol" {
                                        product_mapping
                                            .insert(account_pubkey.clone(), val.to_string());
                                    }
                                }
                            }
                            Err(err) => {
                                tracing::error!("Error loading product account {:?}", err);
                                continue;
                            }
                        }
                    }
                }
            }
        }
        println!("{:?}", product_mapping);

        // Ok(product_mapping)
        // Ok(vec![PriceFeedV2 {
        //     id:         PriceIdentifier::new([0; 32]), // Placeholder value
        //     attributes: std::collections::HashMap::new(), // Empty attributes
        // }])
        Ok(price_feeds)
    }
}
