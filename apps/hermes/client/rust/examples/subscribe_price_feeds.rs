use std::{
    collections::HashMap,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use pyth_hermes_client_rust::{
    backoff::HermesExponentialBackoffBuilder,
    client::HermesClientBuilder,
    ws_connection::{
        HermesClientMessageSubscribe, HermesClientMessageUnsubscribe, HermesServerMessage,
    },
    IDS,
};
use tokio::pin;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let ids: Vec<String> = IDS.iter().map(|s| s.to_string()).collect();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env()?,
        )
        .json()
        .init();

    let mut map: HashMap<String, i64> = ids.iter().map(|id| (id.clone(), 0)).collect();

    // Create and start the client
    let mut client = HermesClientBuilder::default()
        // Optionally override the default endpoints
        .with_endpoints(vec![
            "wss://hermes-stable-cyan.dourolabs.app/ws".parse()?,
            "wss://hermes-stable-yellow.dourolabs.app/ws".parse()?,
            "wss://hermes-stable-green.dourolabs.app/ws".parse()?,
        ])
        // .with_endpoints(vec![
        //     "ws://localhost:8080/ws".parse()?,
        //     "ws://localhost:8081/ws".parse()?,
        //     "wss://hermes-stable-yellow.dourolabs.app/ws".parse()?,
        // ])
        // Optionally set the number of connections
        .with_num_connections(6)
        // Optionally set the backoff strategy
        .with_backoff(
            HermesExponentialBackoffBuilder::default()
                .with_max_interval(Duration::from_secs(5))
                .build(),
        )
        // Optionally set the timeout for each connection
        .with_timeout(Duration::from_secs(2))
        // Optionally set the channel capacity for responses
        .with_channel_capacity(1000)
        .build()?;

    let stream = client.start().await?;
    pin!(stream);

    let subscribe_request = HermesClientMessageSubscribe {
        ids: ids.clone(),
        verbose: true,
        binary: false,
        allow_out_of_order: false,
        ignore_invalid_price_ids: false,
    };

    client.subscribe(subscribe_request).await?;

    println!("Subscribed to price feeds. Waiting for updates...");

    // Process the first few updates
    let mut slot = 0;
    loop {
        match tokio::time::timeout(Duration::from_millis(1000), stream.recv()).await {
            Ok(Some(msg)) => {
                // The stream gives us base64-encoded binary messages. We need to decode, parse, and verify them.
                if let HermesServerMessage::PriceUpdate { price_feed } = msg.clone() {
                    let current_time = price_feed
                        .clone()
                        .metadata
                        .unwrap()
                        .price_service_receive_time
                        .unwrap();

                    if price_feed.price.price == 0 {
                        // println!(
                        //     "Received price feed with zero price: {:?}",
                        //     price_feed.clone()
                        // );
                        continue;
                    }

                    // get current unix time in seconds from system
                    let now: i64 = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64; // u64, seconds since Unix epoch

                    for (id, time) in map.iter() {
                        // println!(
                        //     "now: {}, time: {}, diff: {}, id: {}",
                        //     now,
                        //     *time,
                        //     now - *time,
                        //     id
                        // );
                        // if now - *time > 2 && *time > 0 {
                        //     println!("delayed update for {} : {}", id, now - *time);
                        //     break;
                        // }
                    }

                    let entity = map.get_mut(&price_feed.id).unwrap();
                    *entity = current_time;
                } else {
                    println!("Received unexpected message: {:?}", msg);
                }
            }
            Ok(None) => {
                println!("Stream ended");
                break;
            }
            Err(_) => {
                println!("No message received in 5 seconds");
                break;
            }
        }
    }

    // Unsubscribe example

    client
        .unsubscribe(HermesClientMessageUnsubscribe { ids: ids.clone() })
        .await?;
    println!("Unsubscribed from price feeds.");

    Ok(())
}
