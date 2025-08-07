use std::time::Duration;

use pyth_hermes_client_rust::{
    backoff::HermesExponentialBackoffBuilder,
    client::HermesClientBuilder,
    ws_connection::{HermesClientMessageSubscribe, HermesClientMessageUnsubscribe},
};
use tokio::pin;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env()?,
        )
        .json()
        .init();

    // Create and start the client
    let mut client = HermesClientBuilder::default()
        // Optionally override the default endpoints
        .with_endpoints(vec!["wss://hermes.pyth.network/ws".parse()?])
        // Optionally set the number of connections
        .with_num_connections(4)
        // Optionally set the backoff strategy
        .with_backoff(HermesExponentialBackoffBuilder::default().build())
        // Optionally set the timeout for each connection
        .with_timeout(Duration::from_secs(5))
        // Optionally set the channel capacity for responses
        .with_channel_capacity(1000)
        .build()?;

    let stream = client.start().await?;
    pin!(stream);

    let subscribe_request = HermesClientMessageSubscribe {
        ids: vec!["2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b".to_string()],
        verbose: true,
        binary: true,
        allow_out_of_order: false,
        ignore_invalid_price_ids: false,
    };

    client.subscribe(subscribe_request).await?;

    println!("Subscribed to price feeds. Waiting for updates...");

    // Process the first few updates
    let mut count = 0;
    while let Some(msg) = stream.recv().await {
        // The stream gives us base64-encoded binary messages. We need to decode, parse, and verify them.

        println!("Received message: {msg:#?}");
        println!();

        count += 1;
        if count >= 50 {
            break;
        }
    }

    // Unsubscribe example

    client
        .unsubscribe(HermesClientMessageUnsubscribe {
            ids: vec![
                "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b".to_string(),
            ],
        })
        .await?;
    println!("Unsubscribed from price feeds.");

    Ok(())
}
