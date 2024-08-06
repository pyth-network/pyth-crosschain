use futures_util::{pin_mut, StreamExt};
use hermes_types::{AssetType, EncodingType};
use price_service_client::hermes_client::{HermesClient, HermesClientConfig, ParamOption};

const ENDPOINT: &str = "https://hermes.pyth.network";

#[tokio::main]
async fn main() {
    let config = HermesClientConfig::new(None);
    let connection = HermesClient::new(ENDPOINT, Some(config)).expect("Failed to construct client");

    let price_ids = vec!["e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"];

    // Get price feeds
    let price_feeds = connection
        .get_price_feeds(Some(ParamOption::new(
            Some("btc".to_string()),
            Some(AssetType::Crypto),
            None,
            None,
            None,
            None,
        )))
        .await
        .expect("Failed to get price feeds");
    println!("Price Feeds length: {}", price_feeds.len());

    // Laetst price updates
    let price_updates = connection
        .get_latest_price_updates(&price_ids, None)
        .await
        .expect("Failed to get latest price updates");
    println!(
        "Price updates binary data length: {}",
        price_updates.binary.data.len()
    );

    // Streaming price updates
    let price_updates_stream = connection.get_price_updates_stream(
        &price_ids,
        Some(ParamOption::new(
            None,
            None,
            Some(EncodingType::Hex),
            Some(true),
            Some(true),
            Some(true),
        )),
    );
    pin_mut!(price_updates_stream);

    while let Some(price_update_result) = price_updates_stream.next().await {
        match price_update_result {
            Ok(price_update) => {
                // Process the price update
                println!("Received price update: {:?}", price_update);
            }
            Err(e) => {
                eprintln!("Error receiving price update: {:?}", e);
            }
        }
    }
}
