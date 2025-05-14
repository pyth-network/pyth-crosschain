use futures_util::stream::StreamExt;
use hermes_client::apis::configuration::Configuration;
use hermes_client::models::{EncodingType, ParsedPriceUpdate, PriceUpdate};
use std::error::Error;
use std::time::Duration;

const BTC_PRICE_FEED_ID: &str = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const ETH_PRICE_FEED_ID: &str = "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

async fn create_sse_price_stream(
    config: &Configuration,
    price_feed_ids: Vec<String>,
) -> Result<impl futures_util::Stream<Item = Result<ParsedPriceUpdate, Box<dyn Error + Send + Sync>>>, Box<dyn Error>> {
    let base_url = format!("{}/v2/updates/price/stream", config.base_path);
    let mut url = reqwest::Url::parse(&base_url)?;

    let mut query_pairs = url.query_pairs_mut();
    for id in price_feed_ids {
        query_pairs.append_pair("ids[]", &id);
    }
    query_pairs.append_pair("encoding", "base64");
    query_pairs.append_pair("parsed", "true");
    drop(query_pairs);

    let client = reqwest::Client::builder()
        .build()?;

    let response = client.get(url)
        .header("Accept", "text/event-stream")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("Failed to connect to SSE endpoint: {}", response.status()).into());
    }

    let stream = response.bytes_stream();

    let sse_stream = eventsource_stream::EventStream::new(stream)
        .map(|event_result| {
            match event_result {
                Ok(event) => {
                    if event.event_type() != "message" {
                        return Err("Unexpected event type".into());
                    }

                    let data = event.data();
                    match serde_json::from_str::<PriceUpdate>(data) {
                        Ok(price_update) => {
                            if let Some(Some(parsed_updates)) = price_update.parsed {
                                Ok(futures_util::stream::iter(
                                    parsed_updates.into_iter().map(Ok)
                                ))
                            } else {
                                Err("No parsed price updates in the response".into())
                            }
                        },
                        Err(e) => Err(format!("Failed to parse price update: {}", e).into()),
                    }
                },
                Err(e) => Err(format!("Error in SSE stream: {}", e).into()),
            }
        })
        .flat_map(|result| {
            match result {
                Ok(stream) => stream,
                Err(e) => futures_util::stream::once(async move { Err(e) }),
            }
        });

    Ok(sse_stream)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let mut config = Configuration::new();
    config.base_path = "https://hermes.pyth.network".to_string();

    let price_feed_ids = vec![
        BTC_PRICE_FEED_ID.to_string(),
        ETH_PRICE_FEED_ID.to_string()
    ];

    println!("Starting SSE price stream for BTC/USD and ETH/USD...");
    println!("Press Ctrl+C to exit");
    println!("====================");

    let mut stream = create_sse_price_stream(&config, price_feed_ids).await?;

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
                let price_value = price.price.parse::<f64>().unwrap_or(0.0) * 10f64.powi(price.expo);
                let conf_value = price.conf.parse::<f64>().unwrap_or(0.0) * 10f64.powi(price.expo);

                println!(
                    "{}: ${:.2} (conf: ${:.2}, publish_time: {})",
                    symbol,
                    price_value,
                    conf_value,
                    price.publish_time
                );
            },
            Err(e) => {
                eprintln!("Error: {}", e);
            }
        }
    }

    Ok(())
}
