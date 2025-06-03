use futures_util::stream::StreamExt;
use hermes_client::create_price_update_stream;
use hermes_client::Configuration;
use std::error::Error;

const BTC_PRICE_FEED_ID: &str = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const ETH_PRICE_FEED_ID: &str = "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let mut config = Configuration::new();
    config.base_path = "https://hermes.pyth.network".to_string();

    let price_feed_ids = vec![BTC_PRICE_FEED_ID.to_string(), ETH_PRICE_FEED_ID.to_string()];

    println!("Starting SSE price stream for BTC/USD and ETH/USD...");
    println!("Press Ctrl+C to exit");
    println!("====================");

    let mut stream = create_price_update_stream(
        &config,
        price_feed_ids,
        None, // default encoding (base64)
        None, // default allow_unordered
        None, // default benchmarks_only
        None, // default ignore_invalid_price_ids
    )
    .await?;

    while let Some(result) = stream.next().await {
        match result {
            Ok(update) => {
                let price_feed_id = &update.id;
                let symbol = match price_feed_id.as_str() {
                    BTC_PRICE_FEED_ID => "BTC/USD",
                    ETH_PRICE_FEED_ID => "ETH/USD",
                    _ => "Unknown",
                };

                let price = &update.price;
                let price_value =
                    price.price.parse::<f64>().unwrap_or(0.0) * 10f64.powi(price.expo);
                let conf_value = price.conf.parse::<f64>().unwrap_or(0.0) * 10f64.powi(price.expo);

                println!(
                    "{}: ${:.2} (conf: ${:.2}, publish_time: {})",
                    symbol, price_value, conf_value, price.publish_time
                );
            }
            Err(e) => {
                eprintln!("Error: {}", e);
            }
        }
    }

    Ok(())
}
