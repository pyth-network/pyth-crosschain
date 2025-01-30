use {
    anyhow::Result,
    pyth_lazer_consumer::{Chain, DeliveryFormat, PriceFeedId, PriceFeedProperty, PythLazerConsumer, Response},
    tokio,
};

#[tokio::main]
async fn main() -> Result<()> {
    let mut consumer = PythLazerConsumer::new(
        vec!["wss://endpoint.pyth.network".to_string()],
        "your_token_here".to_string(),
    )
    .await?;

    // Connect to the WebSocket server
    consumer.connect().await?;

    // Subscribe to some price feeds
    consumer
        .subscribe(
            1, // subscription_id
            vec![PriceFeedId(1)],
            Some(vec![PriceFeedProperty::Price, PriceFeedProperty::Exponent]),
            Some(vec![Chain::Evm]),
            Some(DeliveryFormat::Json),
        )
        .await?;

    // Receive updates
    let mut rx = consumer.subscribe_to_updates();
    while let Ok(update) = rx.recv().await {
        match update {
            Response::StreamUpdated(update) => {
                println!("Received update for subscription {}", update.subscription_id.0);
                if let Some(parsed) = update.payload.parsed {
                    for feed in parsed.price_feeds {
                        println!("  Feed ID: {:?}", feed.price_feed_id);
                        println!("  Price: {:?}", feed.price);
                        println!("  Exponent: {:?}", feed.exponent);
                    }
                }
            }
            _ => {}
        }
    }

    Ok(())
}
